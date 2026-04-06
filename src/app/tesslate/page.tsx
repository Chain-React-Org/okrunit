import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TesslateHero } from "@/components/landing/tesslate-hero";

export const metadata = {
  title: "OKrunit - Human Approval for Every Automation",
  description:
    "Universal approval gateway for AI agents and automation platforms. Get human approval before destructive actions execute.",
};

export default function TesslatePage() {
  return (
    <Suspense fallback={null}>
      <TesslateContent />
    </Suspense>
  );
}

async function TesslateContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <TesslateHero
      user={
        user
          ? {
              email: user.email ?? "",
              full_name: user.user_metadata?.full_name ?? null,
            }
          : null
      }
    />
  );
}
