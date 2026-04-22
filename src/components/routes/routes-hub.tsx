"use client";

import { useState, useCallback } from "react";
import { Route } from "lucide-react";
import { toast } from "sonner";

import dynamic from "next/dynamic";
import { EmptyState } from "@/components/ui/empty-state";
import type { ApprovalFlow } from "@/lib/types/database";
import { useRealtime } from "@/hooks/use-realtime";

const FlowCard = dynamic(
  () => import("@/components/routes/flow-card").then((m) => m.FlowCard),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-lg border bg-muted" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamOption {
  id: string;
  name: string;
}

export interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface RoutesHubProps {
  flows: ApprovalFlow[];
  teams: TeamOption[];
  members: MemberOption[];
  orgId: string;
  positionsMap?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoutesHub({
  flows: initialFlows,
  teams,
  members,
  orgId,
  positionsMap,
}: RoutesHubProps) {
  const [flows, setFlows] = useState(initialFlows);

  useRealtime<ApprovalFlow>({
    table: "approval_flows",
    filter: `org_id=eq.${orgId}`,
    onInsert: useCallback((record: ApprovalFlow) => {
      setFlows((prev) => (prev.some((f) => f.id === record.id) ? prev : [record, ...prev]));
      toast.info(`New flow from ${record.source}`);
    }, []),
    onUpdate: useCallback((record: ApprovalFlow) => {
      setFlows((prev) => prev.map((f) => (f.id === record.id ? record : f)));
    }, []),
    onDelete: useCallback((oldRecord: ApprovalFlow) => {
      setFlows((prev) => prev.filter((f) => f.id !== oldRecord.id));
    }, []),
  });

  const handleDelete = useCallback((flowId: string) => {
    const previous = flows;
    // Optimistic: remove immediately
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
    toast.success("Flow deleted");

    // Background: send delete request
    fetch(`/api/v1/flows/${flowId}`, { method: "DELETE" }).then((res) => {
      if (!res.ok) {
        // Revert on failure
        setFlows(previous);
        toast.error("Failed to delete flow");
      }
    }).catch(() => {
      setFlows(previous);
      toast.error("Failed to delete flow");
    });
  }, [flows]);

  if (flows.length === 0) {
    return (
      <EmptyState
        icon={Route}
        title="No approval flows yet"
        description="Flows are created automatically when a source (Zapier, Make, etc.) sends its first approval request. Connect a source to get started."
      />
    );
  }

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Approval Flows</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each source workflow gets its own flow. Configure who must approve, how many approvals are needed, and the approval order.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {flows.map((flow, idx) => (
            <div key={flow.id} data-tour={idx === 0 ? "flow-card" : undefined}>
              <FlowCard
                flow={flow}
                teams={teams}
                members={members}
                orgId={orgId}
                positionsMap={positionsMap}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
