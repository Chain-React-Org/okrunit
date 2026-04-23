"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface LinkNonceConfirmProps {
  nonce: string;
  platform: string;
  platformLabel: string;
  externalUsername: string | null;
  okrunitEmail: string;
  okrunitName: string | null;
}

export function LinkNonceConfirm({
  nonce,
  platform,
  platformLabel,
  externalUsername,
  okrunitEmail,
  okrunitName,
}: LinkNonceConfirmProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [linked, setLinked] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/messaging/identities/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to link account");
      }
      setLinked(true);
      toast.success(`${platformLabel} account linked.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't link account");
    } finally {
      setSubmitting(false);
    }
  }

  if (linked) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
          <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold">Linked</h1>
        <p className="text-sm text-muted-foreground">
          Head back to {platformLabel} and tap Approve or Reject again. Your
          click will go through this time.
        </p>
        <Button asChild variant="outline">
          <Link href="/requests/messaging">Open OKrunit</Link>
        </Button>
      </div>
    );
  }

  const handleDisplay = externalUsername ? `@${externalUsername}` : "this account";
  const okrunitDisplay = okrunitName ? `${okrunitName} (${okrunitEmail})` : okrunitEmail;

  return (
    <div className="mx-auto max-w-md space-y-5 p-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold">Link your {platformLabel} account</h1>
        <p className="text-sm text-muted-foreground">
          Approve and Reject clicks from {handleDisplay} will be attributed
          to your OKrunit account.
        </p>
      </div>

      <div className="rounded-lg border bg-[var(--card)] p-4 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2.5">
          <span className="text-muted-foreground">{platformLabel}</span>
          <span className="font-medium">{handleDisplay}</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-2.5">
          <span className="text-muted-foreground">OKrunit</span>
          <span className="truncate font-medium">{okrunitDisplay}</span>
        </div>
      </div>

      <Button onClick={handleConfirm} disabled={submitting} className="w-full gap-2">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Link these accounts
      </Button>

      <div className="space-y-1 text-center text-xs text-muted-foreground">
        <p>Want to link a different OKrunit account?</p>
        <form action="/api/auth/signout" method="post" className="inline">
          <input
            type="hidden"
            name="next"
            value={`/link/${platform}/__resume`}
          />
          <button
            type="submit"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            onClick={() => router.refresh()}
          >
            Sign out and sign in as a different user
          </button>
        </form>
      </div>
    </div>
  );
}
