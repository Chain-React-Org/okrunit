// ---------------------------------------------------------------------------
// OKRunit -- Team Invite API: Create Invite + Send Email
// ---------------------------------------------------------------------------

import { randomBytes } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAddTeamMember } from "@/lib/billing/enforce";
import { INVITE_EXPIRY_DAYS } from "@/lib/constants";
import { buildInviteEmailHtml } from "@/lib/email/invite";
import type { OrgInvite } from "@/lib/types/database";

// ---- Validation -----------------------------------------------------------

const inviteBodySchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

const revokeBodySchema = z.object({
  invite_id: z.string().uuid("Invalid invite ID"),
});

// ---- POST /api/v1/team/invite ---------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session-only: API keys cannot create invites.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage team invites");
    }

    // Must be admin or owner.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Billing plan enforcement
    const billingCheck = await canAddTeamMember(auth.orgId);
    if (!billingCheck.allowed) {
      return NextResponse.json(
        {
          error: billingCheck.reason,
          code: "PLAN_LIMIT_EXCEEDED",
          upgrade_required: true,
          limit: billingCheck.limit,
          current: billingCheck.current,
          plan: billingCheck.plan,
        },
        { status: 403 },
      );
    }

    // Validate request body.
    let body: z.infer<typeof inviteBodySchema>;
    try {
      body = inviteBodySchema.parse(await request.json());
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
    const normalizedEmail = body.email.toLowerCase().trim();

    // Check that the email isn't already a member of the org.
    // First find a user profile with this email, then check for membership.
    const { data: profileWithEmail } = await admin
      .from("user_profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let existingMember = null;
    if (profileWithEmail) {
      const { data: membership } = await admin
        .from("org_memberships")
        .select("id")
        .eq("user_id", profileWithEmail.id)
        .eq("org_id", auth.orgId)
        .maybeSingle();
      existingMember = membership;
    }

    if (existingMember) {
      throw new ApiError(
        409,
        "This email is already a member of the organization",
        "ALREADY_MEMBER",
      );
    }

    // Check that no pending invite exists for this email in this org.
    const { data: existingInvite } = await admin
      .from("org_invites")
      .select("id")
      .eq("org_id", auth.orgId)
      .eq("email", normalizedEmail)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      throw new ApiError(
        409,
        "A pending invite already exists for this email",
        "INVITE_EXISTS",
      );
    }

    // Generate invite token and calculate expiry.
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    // Insert the invite.
    const { data: invite, error: insertError } = await admin
      .from("org_invites")
      .insert({
        org_id: auth.orgId,
        email: normalizedEmail,
        role: body.role,
        token,
        invited_by: auth.user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, org_id, email, role, invited_by, expires_at, created_at")
      .single<Omit<OrgInvite, "token" | "accepted_at">>();

    if (insertError || !invite) {
      console.error("[Team] Failed to create invite:", insertError);
      throw new ApiError(500, "Failed to create invite");
    }

    // Fetch org name for the email.
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", auth.orgId)
      .single();

    const orgName = org?.name ?? "your team";

    // Send invite email via Resend (skip if RESEND_API_KEY is not configured).
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteLink = `${appUrl}/invite/${token}`;
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ?? "OKRunit <noreply@okrunit.com>";

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = buildInviteEmailHtml({
          orgName,
          role: body.role,
          inviteLink,
        });

        await resend.emails.send({
          from: fromAddress,
          to: normalizedEmail,
          subject: `You've been invited to join ${orgName} on OKRunit`,
          html,
        });
      } catch (emailError) {
        // Log but don't fail the request -- the invite is already created.
        console.error("[Team] Failed to send invite email:", emailError);
      }
    } else {
      console.warn(
        "[Team] RESEND_API_KEY is not set. Skipping invite email for:",
        normalizedEmail,
      );
    }

    // Audit the invite creation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "invite.created",
      resourceType: "org_invite",
      resourceId: invite.id,
      details: { email: normalizedEmail, role: body.role },
      ipAddress,
    });

    return NextResponse.json({ data: invite }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/team/invite -------------------------------------------

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session-only: API keys cannot revoke invites.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage team invites");
    }

    // Must be admin or owner.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof revokeBodySchema>;
    try {
      body = revokeBodySchema.parse(await request.json());
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

    // Verify the invite belongs to the same org.
    const { data: invite } = await admin
      .from("org_invites")
      .select("id, email")
      .eq("id", body.invite_id)
      .eq("org_id", auth.orgId)
      .is("accepted_at", null)
      .single();

    if (!invite) {
      throw new ApiError(404, "Invite not found");
    }

    // Delete the invite.
    const { error: deleteError } = await admin
      .from("org_invites")
      .delete()
      .eq("id", body.invite_id);

    if (deleteError) {
      console.error("[Team] Failed to revoke invite:", deleteError);
      throw new ApiError(500, "Failed to revoke invite");
    }

    // Audit the revocation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "invite.revoked",
      resourceType: "org_invite",
      resourceId: body.invite_id,
      details: { email: invite.email },
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
