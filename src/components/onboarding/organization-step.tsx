"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StepLayout } from "./step-layout";
import { Building2, ShieldCheck } from "lucide-react";
import { useOrgName } from "@/components/org/org-name-context";
import type { RejectionReasonPolicy } from "@/lib/types/database";

interface OrganizationStepProps {
  initialName: string;
  orgId: string;
  onComplete: () => void;
  onBack?: () => void;
}

const REJECTION_REASON_OPTIONS: {
  value: RejectionReasonPolicy;
  label: string;
  description: string;
}[] = [
  {
    value: "optional",
    label: "Optional",
    description: "Reviewers can add a reason but aren't required to",
  },
  {
    value: "required",
    label: "Required",
    description: "A reason must be provided for all rejections",
  },
  {
    value: "required_high_critical",
    label: "Required for high/critical",
    description: "Only require reasons for high and critical priority rejections",
  },
];

export function OrganizationStep({
  initialName,
  orgId,
  onComplete,
  onBack,
}: OrganizationStepProps) {
  const { setOrgName } = useOrgName();
  const [name, setName] = useState(initialName || "");
  const [rejectionPolicy, setRejectionPolicy] =
    useState<RejectionReasonPolicy>("optional");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    if (!name.trim()) {
      setError("Organization name is required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            rejection_reason_policy: rejectionPolicy,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update organization name.");
          return;
        }

        // Optimistically update the header so it reflects the new name
        // without needing a full page refresh after setup completes.
        setOrgName(orgId, name.trim());

        onComplete();
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <StepLayout
      stepNumber={1}
      totalSteps={3}
      title="Name your organization"
      description="This is how your organization will appear across OKrunit. You can change it later in settings."
      onNext={handleNext}
      onBack={onBack}
      showBack={false}
      nextLabel="Save & Continue"
      nextDisabled={!name.trim()}
      isLoading={isPending}
    >
      <div className="space-y-6">
        {/* Organization Name */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Organization name</p>
            <p className="text-xs text-muted-foreground">
              Your team will see this name when working in OKrunit.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            type="text"
            placeholder="e.g., Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            autoFocus
          />
        </div>

        {/* Rejection Reason Policy */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Rejection reason policy</p>
            <p className="text-xs text-muted-foreground">
              When someone rejects a request, should they provide a reason?
            </p>
          </div>
        </div>

        <RadioGroup
          value={rejectionPolicy}
          onValueChange={(value) =>
            setRejectionPolicy(value as RejectionReasonPolicy)
          }
          disabled={isPending}
          className="space-y-3"
        >
          {REJECTION_REASON_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`policy-${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem
                value={option.value}
                id={`policy-${option.value}`}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight">
                  {option.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </StepLayout>
  );
}
