import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingSiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: {
    default: "Company & Trust",
    template: "%s | OKrunit",
  },
};

export default function MarketingPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MarketingShell>{children}</MarketingShell>}>
      <MarketingContent>{children}</MarketingContent>
    </Suspense>
  );
}

function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingSiteHeader user={null} />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

async function MarketingContent({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingSiteHeader
        user={
          user
            ? {
                email: user.email ?? "",
                full_name: user.user_metadata?.full_name ?? null,
              }
            : null
        }
      />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
