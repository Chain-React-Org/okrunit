// ---------------------------------------------------------------------------
// OKrunit -- Onboarding Tour State API
// ---------------------------------------------------------------------------
// GET: Load tour state from user profile
// PATCH: Save tour state to user profile
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("onboarding_tour_step, onboarding_tour_completed, onboarding_tour_dismissed, onboarding_toured_pages")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    userId: user.id,
    currentStep: data?.onboarding_tour_step ?? 0,
    tourCompleted: data?.onboarding_tour_completed ?? false,
    tourDismissed: data?.onboarding_tour_dismissed ?? false,
    touredPages: data?.onboarding_toured_pages ?? [],
  });
}

export async function PATCH(request: Request) {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (body.currentStep !== undefined) update.onboarding_tour_step = body.currentStep;
  if (body.tourCompleted !== undefined) update.onboarding_tour_completed = body.tourCompleted;
  if (body.tourDismissed !== undefined) update.onboarding_tour_dismissed = body.tourDismissed;
  if (body.touredPages !== undefined) update.onboarding_toured_pages = body.touredPages;

  if (Object.keys(update).length > 0) {
    await admin
      .from("user_profiles")
      .update(update)
      .eq("id", user.id);
  }

  return NextResponse.json({ success: true });
}
