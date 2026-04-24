// ---------------------------------------------------------------------------
// OKrunit -- Team Members API: List + Add + Remove + Update Position
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, emailCard, emailButton, escapeHtml } from "@/lib/email/layout";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { logger } from "@/lib/monitoring/logger";
import { titleCaseName } from "@/lib/format-name";

// ---- Validation -----------------------------------------------------------

// Supports both single user_id and bulk user_ids
const addMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID").optional(),
  user_ids: z.array(z.string().uuid("Invalid user ID")).min(1).max(50).optional(),
}).refine(
  (data) => data.user_id || (data.user_ids && data.user_ids.length > 0),
  { message: "Provide user_id or user_ids" },
);

const removeMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
});

const updateMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  position_id: z.string().uuid().nullable().optional(),
  is_lead: z.boolean().optional(),
});

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Verify that a team exists and belongs to the given org. Returns the team
 * row or throws a 404.
 */
async function fetchTeamOrThrow(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  orgId: string,
) {
  const { data: team, error } = await admin
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .eq("org_id", orgId)
    .single();

  if (error || !team) {
    throw new ApiError(404, "Team not found");
  }

  return team;
}

/**
 * Check if a user is a team lead for the given team.
 */
async function isTeamLead(
  admin: ReturnType<typeof createAdminClient>,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("team_memberships")
    .select("is_lead")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();
  return data?.is_lead === true;
}

/**
 * Check if user is org admin or team lead. Throws 403 if neither.
 */
async function requireTeamManagePermission(
  admin: ReturnType<typeof createAdminClient>,
  auth: { membership: { role: string }; user: { id: string } },
  teamId: string,
) {
  const isOrgAdmin = auth.membership.role === "owner" || auth.membership.role === "admin";
  if (isOrgAdmin) return;
  const lead = await isTeamLead(admin, teamId, auth.user.id);
  if (!lead) {
    throw new ApiError(403, "Insufficient permissions");
  }
}

// ---- GET /api/v1/teams/[id]/members ---------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Session or OAuth (Zapier needs this for dynamic dropdowns).
    // API keys cannot access team members.
    if (auth.type === "api_key") {
      throw new ApiError(403, "API key auth not supported for this endpoint");
    }

    const admin = createAdminClient();

    // Verify the team exists and belongs to this org.
    await fetchTeamOrThrow(admin, id, auth.orgId);

    // Fetch team memberships.
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

    return NextResponse.json({ data: members });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- Email notification helper -------------------------------------------

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function sendTeamAddedEmail(
  to: string,
  teamName: string,
  teamId: string,
  addedByName: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const resend = new Resend(apiKey);
    const teamsUrl = `${APP_URL}/org/teams/${teamId}`;
    const html = emailLayout({
      preheader: `You've been added to ${teamName}`,
      body: emailCard(
        `<p style="margin:0 0 8px;font-size:16px;font-weight:600;">You've been added to ${escapeHtml(teamName)}</p>` +
        `<p style="margin:0 0 16px;color:#6b7280;">${escapeHtml(addedByName)} added you to this team. You can now participate in approvals routed to this team.</p>` +
        emailButton({ label: "View Team", href: teamsUrl }),
        { tone: "brand" },
      ),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You've been added to ${teamName}`,
      html,
    });
  } catch (err) {
    logger.error("[Email] Failed to send team-added email:", err);
  }
}

// ---- POST /api/v1/teams/[id]/members --------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    const admin = createAdminClient();
    await requireTeamManagePermission(admin, auth, id);

    let body: z.infer<typeof addMemberSchema>;
    try {
      body = addMemberSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Normalize to array
    const userIds = body.user_ids ?? (body.user_id ? [body.user_id] : []);
    if (userIds.length === 0) {
      throw new ApiError(400, "No user IDs provided");
    }

    const team = await fetchTeamOrThrow(admin, id, auth.orgId);

    // Verify all users are org members
    const { data: orgMembers } = await admin
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", auth.orgId)
      .in("user_id", userIds);

    const validUserIds = new Set((orgMembers ?? []).map((m) => m.user_id));
    const toAdd = userIds.filter((uid) => validUserIds.has(uid));

    if (toAdd.length === 0) {
      throw new ApiError(400, "None of the provided users are org members");
    }

    // Bulk insert - skip duplicates
    const rows = toAdd.map((uid) => ({ team_id: id, user_id: uid }));
    const { data: inserted, error: insertError } = await admin
      .from("team_memberships")
      .upsert(rows, { onConflict: "team_id,user_id", ignoreDuplicates: true })
      .select("*");

    if (insertError) {
      logger.error("[Teams] Failed to add team members:", insertError);
      throw new ApiError(500, "Failed to add team members");
    }

    const ipAddress = getIpAddress(request);
    const addedByName = titleCaseName(auth.profile.full_name) || auth.user.email;

    // Audit + send notifications for each added user
    const { data: addedProfiles } = await admin
      .from("user_profiles")
      .select("id, email, full_name")
      .in("id", toAdd);

    const profileMap = new Map((addedProfiles ?? []).map((p) => [p.id, p]));

    await Promise.allSettled(
      toAdd.map(async (uid) => {
        await logAuditEvent({
          orgId: auth.orgId,
          userId: auth.user.id,
          action: "team.member_added",
          resourceType: "team",
          resourceId: id,
          details: { added_user_id: uid, team_name: team.name },
          ipAddress,
        });

        // Send email notification
        const profile = profileMap.get(uid);
        if (profile?.email) {
          await sendTeamAddedEmail(profile.email, team.name, id, addedByName);
        }

        // In-app notification
        await createInAppNotification({
          userId: uid,
          orgId: auth.orgId,
          category: "team_added",
          title: `You were added to ${team.name}`,
          body: `${addedByName} added you to this team.`,
          actorId: auth.user.id,
          actorName: addedByName,
          resourceType: "team",
          resourceId: id,
        });
      }),
    );

    revalidateTags(CacheTags.teams(auth.orgId), CacheTags.members(auth.orgId));

    return NextResponse.json({ data: inserted ?? [], added: toAdd.length }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/teams/[id]/members ------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    const admin = createAdminClient();
    await requireTeamManagePermission(admin, auth, id);

    let body: z.infer<typeof removeMemberSchema>;
    try {
      body = removeMemberSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Verify the team exists and belongs to this org.
    const team = await fetchTeamOrThrow(admin, id, auth.orgId);

    // Verify the user is actually a member of this team.
    const { data: existingMembership, error: checkError } = await admin
      .from("team_memberships")
      .select("id")
      .eq("team_id", id)
      .eq("user_id", body.user_id)
      .single();

    if (checkError || !existingMembership) {
      throw new ApiError(404, "User is not a member of this team");
    }

    // Remove the membership.
    const { error: deleteError } = await admin
      .from("team_memberships")
      .delete()
      .eq("team_id", id)
      .eq("user_id", body.user_id);

    if (deleteError) {
      logger.error("[Teams] Failed to remove team member:", deleteError);
      throw new ApiError(500, "Failed to remove team member");
    }

    // Audit the removal.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "team.member_removed",
      resourceType: "team",
      resourceId: id,
      details: { removed_user_id: body.user_id, team_name: team.name },
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.teams(auth.orgId), CacheTags.members(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/teams/[id]/members ------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage teams");
    }

    const admin = createAdminClient();

    let body: z.infer<typeof updateMemberSchema>;
    try {
      body = updateMemberSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // is_lead changes require org admin; position changes allow team leads
    if (body.is_lead !== undefined) {
      const isOrgAdmin = auth.membership.role === "owner" || auth.membership.role === "admin";
      if (!isOrgAdmin) {
        throw new ApiError(403, "Only org admins can assign team leads");
      }
    } else {
      await requireTeamManagePermission(admin, auth, id);
    }

    await fetchTeamOrThrow(admin, id, auth.orgId);

    const update: Record<string, unknown> = {};
    if (body.position_id !== undefined) update.position_id = body.position_id;
    if (body.is_lead !== undefined) update.is_lead = body.is_lead;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await admin
      .from("team_memberships")
      .update(update)
      .eq("team_id", id)
      .eq("user_id", body.user_id);

    if (error) {
      logger.error("[Teams] Failed to update team member:", error);
      throw new ApiError(500, "Failed to update team member");
    }

    revalidateTags(CacheTags.teams(auth.orgId), CacheTags.members(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
