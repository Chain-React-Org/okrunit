"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Link2, Loader2, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";

type Platform = "slack" | "teams" | "discord" | "telegram";

interface Identity {
  id: string;
  platform: Platform;
  external_user_id: string;
  external_username: string | null;
}

interface MyMessagingIdentitiesProps {
  /** Identities already linked for this user in the current org. */
  initial: Identity[];
  /** Whether each platform has at least one active messaging_connection in
   * the org. If not, "Link" is disabled with a hint. */
  platformAvailability: Record<Platform, boolean>;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  slack: "Slack",
  teams: "Microsoft Teams",
  discord: "Discord",
  telegram: "Telegram",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  slack: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  teams: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  discord: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  telegram: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

export function MyMessagingIdentities({
  initial,
  platformAvailability,
}: MyMessagingIdentitiesProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [identities, setIdentities] = useState(initial);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  // Surface the redirect outcome from the user-link callback.
  useEffect(() => {
    const linked = params?.get("linked");
    const linkError = params?.get("link_error");
    if (linked) toast.success(`${PLATFORM_LABELS[linked as Platform] ?? linked} account linked.`);
    if (linkError) toast.error(`Couldn't link account: ${linkError.replace(/_/g, " ")}.`);
    if (linked || linkError) {
      // Scrub the query params so a refresh doesn't re-toast.
      const url = new URL(window.location.href);
      url.searchParams.delete("linked");
      url.searchParams.delete("link_error");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [params, router]);

  const byPlatform: Partial<Record<Platform, Identity>> = {};
  for (const i of identities) byPlatform[i.platform] = i;

  async function handleUnlink(id: string, platform: Platform) {
    setUnlinking(id);
    // Optimistic: drop locally.
    const previous = identities;
    setIdentities((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/v1/messaging/identities/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to unlink");
      toast.success(`${PLATFORM_LABELS[platform]} account unlinked.`);
    } catch (err) {
      setIdentities(previous);
      toast.error(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setUnlinking(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-[var(--card)] p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Your messaging identities</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Link the messaging accounts you use so Approve/Reject clicks in Slack,
          Teams, Discord, or Telegram are attributed to you. Without a link,
          clicks from that platform are rejected with &ldquo;link your account&rdquo;.
        </p>
      </div>

      <ul className="divide-y divide-border/40">
        {(["slack", "teams", "discord", "telegram"] as Platform[]).map((platform) => {
          const linked = byPlatform[platform];
          const available = platformAvailability[platform];
          return (
            <li key={platform} className="flex items-center gap-3 py-2.5">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${PLATFORM_COLORS[platform]}`}
              >
                {PLATFORM_LABELS[platform]}
              </span>
              <div className="min-w-0 flex-1">
                {linked ? (
                  <>
                    <p className="truncate text-sm">
                      <Check className="mr-1 inline size-3.5 text-emerald-500" />
                      {linked.external_username ?? linked.external_user_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Linked and ready to approve from {PLATFORM_LABELS[platform]}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {available
                      ? "Not linked yet."
                      : `No ${PLATFORM_LABELS[platform]} connection in this org yet — have an admin install it first.`}
                  </p>
                )}
              </div>
              {linked ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  disabled={unlinking === linked.id}
                  onClick={() => handleUnlink(linked.id, platform)}
                >
                  {unlinking === linked.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Unlink className="size-3.5" />
                  )}
                  Unlink
                </Button>
              ) : platform === "telegram" ? (
                <p className="text-[11px] text-muted-foreground">
                  Use the Connect Telegram flow below.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  disabled={!available}
                  asChild={available}
                >
                  {available ? (
                    <a href={`/api/v1/messaging/${platform}/link-user`}>
                      <Link2 className="size-3.5" />
                      Link my {PLATFORM_LABELS[platform]}
                    </a>
                  ) : (
                    <span>
                      <Link2 className="size-3.5" />
                      Link
                    </span>
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
