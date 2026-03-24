"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Users,
  User,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ApprovalStep, StepVote } from "@/lib/types/database";

interface StepWithVotes extends ApprovalStep {
  votes: StepVote[];
}

interface ApprovalStepsProps {
  requestId: string;
  canApprove: boolean;
  currentUserId: string;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  waiting: { icon: Clock, color: "text-muted-foreground", label: "Waiting" },
  active: { icon: ArrowRight, color: "text-amber-500", label: "Active" },
  approved: { icon: CheckCircle, color: "text-emerald-500", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
  skipped: { icon: ArrowRight, color: "text-muted-foreground", label: "Skipped" },
};

export function ApprovalSteps({ requestId, canApprove, currentUserId }: ApprovalStepsProps) {
  const [steps, setSteps] = useState<StepWithVotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingStep, setVotingStep] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSteps = async () => {
    const res = await fetch(`/api/v1/approvals/${requestId}/steps`);
    const data = await res.json();
    setSteps(data.steps ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVote = async (stepId: string, decision: "approve" | "reject") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/approvals/${requestId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(decision === "approve" ? "Step approved" : "Step rejected");
        setComment("");
        setVotingStep(null);
        fetchSteps();
      } else {
        toast.error(data.error ?? "Failed to vote");
      }
    } catch {
      toast.error("Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Approval Steps</h4>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-3">
          {steps.map((step, i) => {
            const config = statusConfig[step.status] ?? statusConfig.waiting;
            const StatusIcon = config.icon;
            const isActive = step.status === "active";
            const hasVoted = step.votes.some((v) => v.user_id === currentUserId);
            const canVoteOnStep = isActive && canApprove && !hasVoted;

            return (
              <div key={step.id} className="relative pl-10">
                {/* Step indicator */}
                <div className={cn(
                  "absolute left-2.5 top-3 flex size-5 items-center justify-center rounded-full bg-white ring-2",
                  step.status === "approved" ? "ring-emerald-500" :
                  step.status === "rejected" ? "ring-red-500" :
                  step.status === "active" ? "ring-amber-500" :
                  "ring-border",
                )}>
                  <StatusIcon className={cn("size-3", config.color)} />
                </div>

                <Card className={cn(
                  "transition-shadow",
                  isActive && "ring-1 ring-amber-200 shadow-sm",
                )}>
                  <CardContent className="p-4">
                    {/* Step header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Step {step.step_order}
                          </span>
                          <Badge
                            variant={step.status === "active" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {config.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm font-semibold">{step.name}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {step.current_approvals}/{step.required_approvals} approvals
                      </div>
                    </div>

                    {/* Assignment info */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {step.assigned_team_id && (
                        <><Users className="size-3" /> Team assigned</>
                      )}
                      {step.assigned_user_ids && step.assigned_user_ids.length > 0 && (
                        <><User className="size-3" /> {step.assigned_user_ids.length} user(s) assigned</>
                      )}
                      {step.assigned_role && (
                        <><Shield className="size-3" /> {step.assigned_role}+ role required</>
                      )}
                      {!step.assigned_team_id && !step.assigned_user_ids?.length && !step.assigned_role && (
                        <>Any member can approve</>
                      )}
                    </div>

                    {/* Votes */}
                    {step.votes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.votes.map((vote) => (
                          <div key={vote.id} className="flex items-center gap-2 text-xs">
                            {vote.vote === "approve" ? (
                              <CheckCircle className="size-3 text-emerald-500" />
                            ) : (
                              <XCircle className="size-3 text-red-500" />
                            )}
                            <span className="text-muted-foreground">
                              {vote.vote === "approve" ? "Approved" : "Rejected"}
                              {vote.comment && ` — "${vote.comment}"`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vote actions */}
                    {canVoteOnStep && (
                      <div className="mt-3 border-t pt-3">
                        {votingStep === step.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Optional comment..."
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              className="h-16 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleVote(step.id, "approve")}
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {submitting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <CheckCircle className="mr-1 size-3" />}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleVote(step.id, "reject")}
                                disabled={submitting}
                              >
                                {submitting ? <Loader2 className="mr-1 size-3 animate-spin" /> : <XCircle className="mr-1 size-3" />}
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setVotingStep(null); setComment(""); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVotingStep(step.id)}
                          >
                            Vote on this step
                          </Button>
                        )}
                      </div>
                    )}

                    {isActive && hasVoted && (
                      <p className="mt-2 text-xs text-muted-foreground">You've already voted on this step</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
