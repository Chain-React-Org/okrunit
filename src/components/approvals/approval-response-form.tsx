"use client";

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalResponseFormProps {
  onRespond: (decision: "approved" | "rejected", comment: string) => void;
  isLoading: boolean;
}

export const ApprovalResponseForm = memo(function ApprovalResponseForm({
  onRespond,
  isLoading,
}: ApprovalResponseFormProps) {
  const [comment, setComment] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);

  if (pendingDecision) {
    const isApprove = pendingDecision === "approved";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPendingDecision(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            <ArrowLeft className="size-4" />
          </button>
          <p className="text-sm font-medium">
            {isApprove ? "Approve" : "Reject"} this request?
          </p>
        </div>
        <Textarea
          placeholder="Add a comment (optional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          disabled={isLoading}
          className="text-sm"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPendingDecision(null)}
            disabled={isLoading}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            variant={isApprove ? "success" : "destructive"}
            size="sm"
            onClick={() => onRespond(pendingDecision, comment)}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Submitting..." : isApprove ? "Confirm Approve" : "Confirm Reject"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3" data-tour="response-form">
      <Button
        variant="success"
        onClick={() => setPendingDecision("approved")}
        disabled={isLoading}
        className="flex-1"
      >
        <CheckCircle className="size-4" />
        Approve
      </Button>
      <Button
        variant="destructive"
        onClick={() => setPendingDecision("rejected")}
        disabled={isLoading}
        className="flex-1"
      >
        <XCircle className="size-4" />
        Reject
      </Button>
    </div>
  );
});
