// ---------------------------------------------------------------------------
// OKrunit -- Teams API: Get + Update + Delete (single team)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation -----------------------------------------------------------

const updateTeamSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(100, "Team name must be 100 characters or fewer")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .optional(),
});

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- GET /api/v1/teams/[id] -----------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Session or OAuth (Zapier needs this for dynamic dropdowns).
    // API keys cannot access teams.
    if (auth.type === "api_key") {
      throw new ApiError(403, "API key auth not supported for this endpoint");
    }

    const admin = createAdminClient();

    // Fetch the team.
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (teamError || !team) {
      throw new ApiError(404, "Team not found");
    }

    // Fetch team memberships joined with user profiles.
    const { data: memberships, error: memberError } = await admin
      .from("team_memberships")
      .select("user_id, created_at")
      .eq("team_id", id);

    if (memberError) {
      logger.error("[Teams] Failed to fetch team members:", memberError);
      throw new ApiError(500, "Failed to fetch team members");
    }

    // Fetch user profiles for the members.
    const userIds = (memberships ?? []).map((m) => m.user_id);
    let members: Array<{
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      joined_at: string;
    }> = [];

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      members = (memberships ?? []).map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          id: m.user_id,
          email: profile?.email ?? "",
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          joined_at: m.created_at,
        };
      });
    }

    return NextResponse.json({
      data: {
        ...team,
        members,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/teams/[id] ---------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage teams.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof updateTeamSchema>;
    try {
      body = updateTeamSchema.parse(await request.json());
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

    // Verify the team exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("teams")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Team not found");
    }

    // Apply the partial update.
    const { data: team, error: updateError } = await admin
      .from("teams")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (updateError || !team) {
      // Handle unique constraint violation (org_id + name).
      if (updateError?.code === "23505") {
        throw new ApiError(
          409,
          "A team with this name already exists",
          "DUPLICATE_NAME",
        );
      }
      logger.error("[Teams] Failed to update team:", updateError);
      throw new ApiError(500, "Failed to update team");
    }

    // Audit the update.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "team.updated",
      resourceType: "team",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.teams(auth.orgId));

    return NextResponse.json({ data: team });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/teams/[id] --------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage teams.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the team exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("teams")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Team not found");
    }

    // Delete the team (CASCADE handles team_memberships).
    const { error: deleteError } = await admin
      .from("teams")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      logger.error("[Teams] Failed to delete team:", deleteError);
      throw new ApiError(500, "Failed to delete team");
    }

    // Audit the deletion.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "team.deleted",
      resourceType: "team",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.teams(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
