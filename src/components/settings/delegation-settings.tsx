"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import { Calendar, Check, Loader2, UserPlus, X, AlertTriangle, Route as RouteIcon, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { ApprovalDelegation } from "@/lib/types/database";

interface DelegateOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ResponsibleFlow {
  id: string;
  name: string;
  source: string;
  lastRequestAt: string | null;
  isConfigured: boolean;
}

type EnrichedDelegation = ApprovalDelegation & {
  role: "delegator" | "delegate";
  counterparty: { id: string; name: string; email: string };
};

interface DelegationSettingsProps {
  initialDelegations: EnrichedDelegation[];
  eligibleDelegates: DelegateOption[];
  responsibleFlows: ResponsibleFlow[];
  currentUserId: string;
}

function classify(d: EnrichedDelegation, now: Date): "active" | "upcoming" | "past" {
  if (!d.is_active) return "past";
  const start = new Date(d.starts_at);
  const end = new Date(d.ends_at);
  if (isBefore(now, start)) return "upcoming";
  if (isAfter(now, end)) return "past";
  return "active";
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  // yyyy-MM-ddTHH:mm for datetime-local inputs.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DelegationSettings({
  initialDelegations,
  eligibleDelegates,
  responsibleFlows,
}: DelegationSettingsProps) {
  const [delegations, setDelegations] = useState(initialDelegations);
  const [delegateId, setDelegateId] = useState<string>("");
  const [reason, setReason] = useState("");
  // Default window: now to one week from now.
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalInput(d.toISOString());
  });
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<EnrichedDelegation | null>(null);

  const now = useMemo(() => new Date(), []);
  const { active, upcoming, past } = useMemo(() => {
    const active: EnrichedDelegation[] = [];
    const upcoming: EnrichedDelegation[] = [];
    const past: EnrichedDelegation[] = [];
    for (const d of delegations) {
      const bucket = classify(d, now);
      (bucket === "active" ? active : bucket === "upcoming" ? upcoming : past).push(d);
    }
    return { active, upcoming, past };
  }, [delegations, now]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!delegateId) {
      toast.error("Pick someone to delegate to");
      return;
    }
    const startsIso = new Date(startsAt).toISOString();
    const endsIso = new Date(endsAt).toISOString();
    if (new Date(endsIso).getTime() <= new Date(startsIso).getTime()) {
      toast.error("End date must be after the start date");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delegate_id: delegateId,
          reason: reason.trim() || undefined,
          starts_at: startsIso,
          ends_at: endsIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create delegation");
      }

      // Enrich locally so the UI updates without a round-trip.
      const match = eligibleDelegates.find((m) => m.id === delegateId);
      const enriched: EnrichedDelegation = {
        ...(data as ApprovalDelegation),
        role: "delegator",
        counterparty: {
          id: delegateId,
          name: match?.name ?? delegateId.slice(0, 8),
          email: match?.email ?? "",
        },
      };
      setDelegations((prev) => [enriched, ...prev]);
      setReason("");
      setDelegateId("");
      toast.success("Delegation created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create delegation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setCancelTarget(null);

    // Optimistic: mark inactive immediately.
    setDelegations((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: false } : d)));

    const res = await fetch(`/api/v1/delegations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      // Revert on failure.
      setDelegations((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: true } : d)));
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to cancel delegation");
    } else {
      toast.success("Delegation cancelled");
    }
  }

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Out of office delegation</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          While this delegation is active, any request routed to you is also
          actionable by the person you pick. Decisions they make are audit
          logged as delegated from you. This is org-wide: it covers every flow
          where you&rsquo;re an assigned approver.
        </p>

        {eligibleDelegates.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20 p-3">
            <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No other teammates with approval permission exist in this
              organization yet. Grant approval permission to someone on the{" "}
              <Link href="/org/members" className="underline underline-offset-2 font-medium">
                Members page
              </Link>{" "}
              first.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Delegate to</Label>
              <Select
                value={delegateId}
                onValueChange={setDelegateId}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a teammate..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleDelegates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="text-sm">{m.name}</span>
                        {m.email && (
                          <span className="text-[11px] text-muted-foreground">
                            {m.email} · {m.role}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Starts</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ends</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. At a conference Mon-Wed, please cover the deploy approvals."
                rows={2}
                maxLength={500}
                disabled={submitting}
              />
            </div>

            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Create delegation
            </Button>
          </form>
        )}
      </div>

      {/* Active + Upcoming + Past */}
      {(active.length > 0 || upcoming.length > 0) && (
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Active &amp; upcoming</h2>
          </div>
          <div className="space-y-2">
            {active.map((d) => (
              <DelegationRow key={d.id} delegation={d} variant="active" onCancel={() => setCancelTarget(d)} />
            ))}
            {upcoming.map((d) => (
              <DelegationRow key={d.id} delegation={d} variant="upcoming" onCancel={() => setCancelTarget(d)} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Past</h2>
          </div>
          <div className="space-y-2">
            {past.slice(0, 10).map((d) => (
              <DelegationRow key={d.id} delegation={d} variant="past" onCancel={() => setCancelTarget(d)} />
            ))}
          </div>
        </div>
      )}

      {/* Flows I'm responsible for */}
      <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <RouteIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Flows you&rsquo;re assigned to</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Flows where you&rsquo;re explicitly named as an approver. A delegation
          above covers incoming requests from all of these.
        </p>
        {responsibleFlows.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            You aren&rsquo;t directly assigned to any flows yet. Team or role-based
            assignments aren&rsquo;t listed here.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {responsibleFlows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="capitalize">{f.source}</span>
                    {f.lastRequestAt && (
                      <> · last request {formatDistanceToNow(new Date(f.lastRequestAt), { addSuffix: true })}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!f.isConfigured && (
                    <Badge variant="outline" className="text-[10px]">Unconfigured</Badge>
                  )}
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link href="/requests/routes">Open</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel delegation?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  This stops {cancelTarget.role === "delegator" ? `delegating to ${cancelTarget.counterparty.name}` : `receiving delegated approvals from ${cancelTarget.counterparty.name}`}.
                  Any requests still waiting for a decision will revert to the original approver only.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Cancel delegation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DelegationRow({
  delegation,
  variant,
  onCancel,
}: {
  delegation: EnrichedDelegation;
  variant: "active" | "upcoming" | "past";
  onCancel: () => void;
}) {
  const { counterparty, role, starts_at, ends_at, reason } = delegation;
  const label = role === "delegator" ? "To" : "From";
  const emailSuffix = counterparty.email ? ` (${counterparty.email})` : "";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-3 py-2.5",
        variant === "active" && "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10",
        variant === "upcoming" && "border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10",
        variant === "past" && "border-border/50 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            <span className="text-muted-foreground">{label}:</span>{" "}
            <span className="font-medium">{counterparty.name}</span>
            <span className="text-muted-foreground text-[11px]">{emailSuffix}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(starts_at), "MMM d, h:mm a")} → {format(new Date(ends_at), "MMM d, h:mm a")}
          </p>
          {reason && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">
              &ldquo;{reason}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              variant === "active" && "border-emerald-300 text-emerald-700 dark:text-emerald-400",
              variant === "upcoming" && "border-blue-300 text-blue-700 dark:text-blue-400",
            )}
          >
            {variant === "active" ? "Active" : variant === "upcoming" ? "Upcoming" : "Ended"}
          </Badge>
          {variant !== "past" && role === "delegator" && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onCancel}
              aria-label="Cancel delegation"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
