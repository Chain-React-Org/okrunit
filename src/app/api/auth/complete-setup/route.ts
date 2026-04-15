// ---------------------------------------------------------------------------
// OKrunit -- Mark Setup as Complete
// ---------------------------------------------------------------------------
// Called when the user finishes the onboarding wizard. Sets the
// setup_completed_at timestamp on their profile.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInAppNotification } from "@/lib/notifications/in-app";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ setup_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[Auth] Failed to mark setup complete:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }

  // Send welcome in-app notification (fire-and-forget)
  const { data: membership } = await admin
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .single();

  if (membership) {
    createInAppNotification({
      userId: user.id,
      orgId: membership.org_id,
      category: "welcome",
      title: "Welcome to OKrunit!",
      body: "You're on a 14-day free trial of Pro with full access to all Pro features. Create a connection to start sending approval requests, or explore the dashboard.",
      resourceType: "org",
      resourceId: membership.org_id,
    });
  }

  return NextResponse.json({ success: true });
}
