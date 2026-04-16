import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const step = typeof body.step === "number" ? body.step : 0;

  const admin = createAdminClient();
  await admin
    .from("user_profiles")
    .update({ setup_wizard_step: step })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
