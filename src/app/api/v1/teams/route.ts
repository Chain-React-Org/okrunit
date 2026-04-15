// ---------------------------------------------------------------------------
// OKrunit -- Teams API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { canCreateTeam } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Validation -----------------------------------------------------------

const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(100, "Team name must be 100 characters or fewer"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
});

// ---- GET /api/v1/teams ----------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session or OAuth (Zapier needs this for dynamic dropdowns).
    // API keys cannot list teams.
    if (auth.type === "api_key") {
      throw new ApiError(403, "API key auth not supported for this endpoint");
    }

    const admin = createAdminClient();

    // Fetch all teams for this org.
    const { data: teams, error } = await admin
      .from("teams")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[Teams] Failed to list teams:", error);
      throw new ApiError(500, "Failed to list teams");
    }

    // Fetch member counts for all teams in a single query.
    const teamIds = (teams ?? []).map((t) => t.id);

    const memberCounts = new Map<string, number>();

    if (teamIds.length > 0) {
      const { data: counts, error: countError } = await admin
        .from("team_memberships")
        .select("team_id")
        .in("team_id", teamIds);

      if (countError) {
        console.error("[Teams] Failed to fetch member counts:", countError);
        // Non-fatal: proceed with zero counts rather than failing the request.
      } else {
        // Tally counts by team_id.
        for (const row of counts ?? []) {
          memberCounts.set(
            row.team_id,
            (memberCounts.get(row.team_id) ?? 0) + 1,
          );
        }
      }
    }

    const teamsWithCounts = (teams ?? []).map((team) => ({
      ...team,
      member_count: memberCounts.get(team.id) ?? 0,
    }));

    return NextResponse.json({ data: teamsWithCounts });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/teams ---------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may create teams.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Check team limit
    const teamCheck = await canCreateTeam(auth.orgId);
    if (!teamCheck.allowed) {
      throw new ApiError(403, teamCheck.reason ?? "Team limit reached", "PLAN_LIMIT_EXCEEDED");
    }

    // Validate request body.
    let body: z.infer<typeof createTeamSchema>;
    try {
      body = createTeamSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    const admin = createAdminClient();

    const { data: team, error } = await admin
      .from("teams")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error || !team) {
      // Handle unique constraint violation (org_id + name).
      if (error?.code === "23505") {
        throw new ApiError(
          409,
          "A team with this name already exists",
          "DUPLICATE_NAME",
        );
      }
      console.error("[Teams] Failed to create team:", error);
      throw new ApiError(500, "Failed to create team");
    }

    // Auto-add the creator as a team member.
    await admin
      .from("team_memberships")
      .upsert({ team_id: team.id, user_id: auth.user.id }, { onConflict: "team_id,user_id", ignoreDuplicates: true });

    // Audit the creation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "team.created",
      resourceType: "team",
      resourceId: team.id,
      details: { name: body.name },
      ipAddress,
    });

    revalidateTags(CacheTags.teams(auth.orgId), CacheTags.overview(auth.orgId));

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
