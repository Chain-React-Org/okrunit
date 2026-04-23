import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupLinkNonce } from "@/lib/messaging/link-nonces";
import { Button } from "@/components/ui/button";
import { LinkNonceConfirm } from "./link-confirm";

export const metadata = {
  title: "Link messaging account - OKrunit",
};

const PLATFORM_LABELS: Record<string, string> = {
  slack: "Slack",
  teams: "Microsoft Teams",
  discord: "Discord",
  telegram: "Telegram",
};

const VALID_PLATFORMS = ["slack", "teams", "discord", "telegram"] as const;

const PENDING_NONCE_COOKIE = "okrunit_pending_link_nonce";

interface PageProps {
  params: Promise<{ platform: string; nonce: string }>;
}

export default function LinkNoncePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      }
    >
      <LinkNonceContent params={params} />
    </Suspense>
  );
}

async function LinkNonceContent({ params }: PageProps) {
  // Opt out of prerendering: this page reads cookies, auth session, and
  // short-lived nonce state that all must run per-request.
  await connection();
  const { platform, nonce } = await params;

  if (!(VALID_PLATFORMS as readonly string[]).includes(platform)) {
    return (
      <FailureState message="Unknown messaging platform in this link." />
    );
  }

  const nonceRow = await lookupLinkNonce(nonce);
  if (!nonceRow) {
    return (
      <FailureState message="This link is invalid or has already been used. Tap Approve or Reject again in your messaging app to get a fresh one." />
    );
  }
  if (new Date(nonceRow.expires_at) < new Date()) {
    return (
      <FailureState message="This link has expired. Tap Approve or Reject again in your messaging app to get a fresh one." />
    );
  }
  if (nonceRow.consumed_at) {
    return (
      <SuccessState
        platformLabel={PLATFORM_LABELS[nonceRow.platform] ?? nonceRow.platform}
        alreadyConsumed
      />
    );
  }

  // Check if there's a signed-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Park the nonce in a short-lived cookie so sign-in / sign-up can resume
  // here afterward even if the URL is lost during the auth redirect.
  const cookieStore = await cookies();
  cookieStore.set(PENDING_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });

  if (!user) {
    return (
      <SignedOutState
        platform={nonceRow.platform}
        platformLabel={PLATFORM_LABELS[nonceRow.platform] ?? nonceRow.platform}
        externalUsername={nonceRow.external_username}
      />
    );
  }

  // Check the user is a member of the org this nonce was created for.
  const admin = createAdminClient();
  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", nonceRow.org_id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!membership) {
    return (
      <NotOrgMemberState
        platformLabel={PLATFORM_LABELS[nonceRow.platform] ?? nonceRow.platform}
        currentEmail={profile?.email ?? user.email ?? ""}
      />
    );
  }

  return (
    <LinkNonceConfirm
      nonce={nonce}
      platform={nonceRow.platform}
      platformLabel={PLATFORM_LABELS[nonceRow.platform] ?? nonceRow.platform}
      externalUsername={nonceRow.external_username}
      okrunitEmail={profile?.email ?? user.email ?? ""}
      okrunitName={profile?.full_name ?? null}
    />
  );
}

function FailureState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Couldn&rsquo;t link your account</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link href="/requests">Go to dashboard</Link>
      </Button>
    </div>
  );
}

function SuccessState({
  platformLabel,
  alreadyConsumed,
}: {
  platformLabel: string;
  alreadyConsumed?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">
        {alreadyConsumed ? "Already linked" : "Linked!"}
      </h1>
      <p className="text-sm text-muted-foreground">
        Your {platformLabel} account is connected. Head back to the messaging
        app and tap Approve or Reject again.
      </p>
      <Button asChild>
        <Link href="/requests/messaging">Open OKrunit</Link>
      </Button>
    </div>
  );
}

function SignedOutState({
  platform,
  platformLabel,
  externalUsername,
}: {
  platform: string;
  platformLabel: string;
  externalUsername: string | null;
}) {
  // The cookie we just set carries the nonce across the sign-in / sign-up
  // flow. On login completion we re-read it from the /requests redirect
  // handler and bounce back here.
  const handleLabel = externalUsername ? ` @${externalUsername}` : "";
  return (
    <div className="mx-auto max-w-md space-y-5 p-6 text-center">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Link your {platformLabel} account</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to OKrunit to connect {platformLabel}{handleLabel}. If you
          don&rsquo;t have an account yet, create one and you&rsquo;ll land back
          here to finish.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link href={`/login?redirect_to=${encodeURIComponent(`/link/${platform}/__resume`)}`}>
            Sign in
          </Link>
        </Button>
        <Button asChild variant="outline">
          {/* Signup doesn't accept a redirect param, but the nonce cookie
              persists so the user can hit /link/<platform>/__resume manually
              after completing email verification. */}
          <Link href="/signup">
            Create an account
          </Link>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        After sign up, your link will be ready at{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{`/link/${platform}/__resume`}</code>.
      </p>
    </div>
  );
}

function NotOrgMemberState({
  platformLabel,
  currentEmail,
}: {
  platformLabel: string;
  currentEmail: string;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Wrong OKrunit account</h1>
      <p className="text-sm text-muted-foreground">
        You&rsquo;re signed in as <strong>{currentEmail}</strong>, but that
        account isn&rsquo;t a member of the organization that posted the{" "}
        {platformLabel} message. Sign out and sign back in with the OKrunit
        account you use for that org.
      </p>
      <form action="/api/auth/signout" method="post">
        <input type="hidden" name="next" value="/login" />
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
