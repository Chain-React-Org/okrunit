import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// When a user completes sign-in / sign-up with `?next=/link/<platform>/__resume`,
// this page pops the pending nonce cookie that was set on the original /link
// visit and bounces them to the real nonce URL so the confirmation screen
// can finish the link.

const VALID_PLATFORMS = ["slack", "teams", "discord", "telegram"] as const;
const PENDING_NONCE_COOKIE = "okrunit_pending_link_nonce";

interface PageProps {
  params: Promise<{ platform: string }>;
}

export default async function LinkNonceResumePage({ params }: PageProps) {
  const { platform } = await params;
  if (!(VALID_PLATFORMS as readonly string[]).includes(platform)) {
    redirect("/requests/messaging");
  }

  const cookieStore = await cookies();
  const nonce = cookieStore.get(PENDING_NONCE_COOKIE)?.value;
  if (!nonce) {
    redirect("/requests/messaging?link_error=missing_nonce");
  }

  redirect(`/link/${platform}/${nonce}`);
}

export const dynamic = "force-dynamic";
