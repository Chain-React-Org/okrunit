import { Suspense } from "react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LandingPage = dynamic(
  () => import("@/components/landing/landing-page").then((m) => m.LandingPage),
  {
    ssr: true,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    ),
  },
);
import {
  OrganizationJsonLd,
  SoftwareAppJsonLd,
  WebsiteJsonLd,
  FAQJsonLd,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://okrunit.com",
  },
};

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareAppJsonLd />
      <WebsiteJsonLd />
      <FAQJsonLd />
      <Suspense fallback={null}>
        <HomeContent />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LandingPage
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
