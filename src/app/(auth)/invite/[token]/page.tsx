// ---------------------------------------------------------------------------
// OKrunit -- Accept Invite Page
// ---------------------------------------------------------------------------

import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/api/audit";
import { createInAppNotification } from "@/lib/notifications/in-app";
import type { OrgInvite, Organization } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accept Invite - OKrunit",
  description: "Accept your team invitation.",
};

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      }
    >
      <InviteAcceptContent params={params} />
    </Suspense>
  );
}

async function InviteAcceptContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const admin = createAdminClient();

  // Look up the invite: must exist, not yet accepted, not expired.
  const { data: invite } = await admin
    .from("org_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single<OrgInvite>();

  if (!invite) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Invalid or Expired Invite
        </h1>
        <p className="text-muted-foreground">
          This invitation link is no longer valid. It may have expired or
          already been used.
        </p>
        <Link
          href="/signup"
          className="text-primary inline-block text-sm font-medium underline underline-offset-4"
        >
          Sign up for a new account
        </Link>
      </div>
    );
  }

  // Fetch the org name for display.
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", invite.org_id)
    .single<Pick<Organization, "name">>();

  const orgName = org?.name ?? "your team";

  // Check if the user is logged in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in: redirect to signup with the invite token.
    redirect(`/signup?invite=${token}`);
  }

  // User is logged in -- verify email matches the invite.
  const userEmail = user.email?.toLowerCase().trim();
  const inviteEmail = invite.email.toLowerCase().trim();

  if (userEmail !== inviteEmail) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Email Mismatch
        </h1>
        <p className="text-muted-foreground">
          This invitation was sent to <strong>{invite.email}</strong>, but you
          are logged in as <strong>{user.email}</strong>.
        </p>
        <p className="text-muted-foreground text-sm">
          Please sign in with the correct email address or ask for a new
          invitation.
        </p>
        <Link
          href="/login"
          className="text-primary inline-block text-sm font-medium underline underline-offset-4"
        >
          Sign in with a different account
        </Link>
      </div>
    );
  }

  // Email matches: accept the invite.
  // 1. Check if user already has a membership in this org.
  const { data: existingMembership } = await admin
    .from("org_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", invite.org_id)
    .maybeSingle();

  if (existingMembership) {
    // Already in this org (likely handled by handle_new_user trigger).
    // Mark invite as accepted if not already.
    await admin
      .from("org_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Switch to the invited org so it's active.
    await admin
      .from("org_memberships")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
    await admin
      .from("org_memberships")
      .update({ is_default: true })
      .eq("user_id", user.id)
      .eq("org_id", invite.org_id);

    redirect("/org/overview?joined=true");
  }

  // 2. Ensure user profile exists.
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    await admin.from("user_profiles").insert({
      id: user.id,
      email: invite.email,
      full_name: user.user_metadata?.full_name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });
  }

  // 3. Create membership in the invited org and make it the active org.
  await admin
    .from("org_memberships")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);

  await admin.from("org_memberships").insert({
    user_id: user.id,
    org_id: invite.org_id,
    role: invite.role,
    is_default: true,
    can_approve: invite.can_approve,
    can_connect: invite.can_connect,
  });

  // 4. Auto-add to teams if specified on the invite.
  const teamIds: string[] = invite.team_ids ?? [];
  const teamLeadIds: string[] = invite.team_lead_ids ?? [];
  if (teamIds.length > 0) {
    const rows = teamIds.map((tid) => ({
      team_id: tid,
      user_id: user.id,
      position_id: invite.position_id ?? null,
      is_lead: teamLeadIds.includes(tid),
    }));
    await admin
      .from("team_memberships")
      .upsert(rows, { onConflict: "team_id,user_id", ignoreDuplicates: true });
  }

  // Mark invite as accepted.
  await admin
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Audit the acceptance.
  await logAuditEvent({
    orgId: invite.org_id,
    userId: user.id,
    action: "invite.accepted",
    resourceType: "org_invite",
    resourceId: invite.id,
    details: { email: invite.email, role: invite.role, team_ids: teamIds },
  });

  // Notify the inviter that their invite was accepted.
  if (invite.invited_by) {
    const memberName = user.user_metadata?.full_name || invite.email;
    await createInAppNotification({
      userId: invite.invited_by,
      orgId: invite.org_id,
      category: "team_invite",
      title: `${memberName} joined ${orgName}`,
      body: `Your invitation was accepted. They joined as ${invite.role}.`,
      actorId: user.id,
      actorName: memberName,
      resourceType: "org_invite",
      resourceId: invite.id,
    });
  }

  redirect("/org/overview?joined=true");
}
