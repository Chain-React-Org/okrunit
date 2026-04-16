// ---------------------------------------------------------------------------
// OKrunit -- Team Positions API: List + Create + Delete
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const createPositionSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
});

const deletePositionSchema = z.object({
  position_id: z.string().uuid(),
});

async function fetchTeamOrThrow(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  orgId: string,
) {
  const { data: team, error } = await admin
    .from("teams")
    .select("id, name, org_id")
    .eq("id", teamId)
    .eq("org_id", orgId)
    .single();
  if (error || !team) throw new ApiError(404, "Team not found");
  return team;
}

async function requireTeamManagePermission(
  admin: ReturnType<typeof createAdminClient>,
  auth: { membership: { role: string }; user: { id: string } },
  teamId: string,
) {
  const isOrgAdmin = auth.membership.role === "owner" || auth.membership.role === "admin";
  if (isOrgAdmin) return;
  const { data } = await admin
    .from("team_memberships")
    .select("is_lead")
    .eq("team_id", teamId)
    .eq("user_id", auth.user.id)
    .single();
  if (data?.is_lead !== true) {
    throw new ApiError(403, "Insufficient permissions");
  }
}

// ---- GET /api/v1/teams/[id]/positions ------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (auth.type === "api_key") throw new ApiError(403, "Session auth required");

    const admin = createAdminClient();
    await fetchTeamOrThrow(admin, id, auth.orgId);

    const { data, error } = await admin
      .from("team_positions")
      .select("id, name, created_at")
      .eq("team_id", id)
      .order("name");

    if (error) throw new ApiError(500, "Failed to fetch positions");
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/teams/[id]/positions -----------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session auth required");

    const admin = createAdminClient();
    await requireTeamManagePermission(admin, auth, id);

    const body = createPositionSchema.parse(await request.json());
    await fetchTeamOrThrow(admin, id, auth.orgId);

    const { data, error } = await admin
      .from("team_positions")
      .insert({ team_id: id, name: body.name })
      .select("id, name, created_at")
      .single();

    if (error) {
      if (error.code === "23505") throw new ApiError(409, "Position already exists");
      throw new ApiError(500, "Failed to create position");
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/teams/[id]/positions ---------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session auth required");

    const admin = createAdminClient();
    await requireTeamManagePermission(admin, auth, id);

    const body = deletePositionSchema.parse(await request.json());
    await fetchTeamOrThrow(admin, id, auth.orgId);

    const { error } = await admin
      .from("team_positions")
      .delete()
      .eq("id", body.position_id)
      .eq("team_id", id);

    if (error) throw new ApiError(500, "Failed to delete position");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
    }
    return errorResponse(err);
  }
}
