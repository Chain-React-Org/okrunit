"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Loader2, Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SafetySettingsProps {
  isAdmin: boolean;
  emergencyStopActive: boolean;
  emergencyStopActivatedAt: string | null;
  emergencyStopActivatedBy: string | null;
  orgId: string;
  autoApprovalsPaused: boolean;
}

export function SafetySettings({
  isAdmin,
  emergencyStopActive,
  emergencyStopActivatedAt,
  emergencyStopActivatedBy,
  autoApprovalsPaused,
}: SafetySettingsProps) {
  const router = useRouter();

  // Emergency stop state
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Pause auto-approvals state
  const [pauseLoading, setPauseLoading] = useState(false);

  async function handleToggleEmergency() {
    setEmergencyLoading(true);
    try {
      const response = await fetch("/api/v1/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !emergencyStopActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to toggle emergency stop");
      }

      const data = await response.json();

      if (!emergencyStopActive) {
        toast.success(
          `Emergency stop activated. ${data.cancelled_count} pending approval(s) cancelled.`,
        );
      } else {
        toast.success("Emergency stop deactivated. System is back to normal.");
      }

      setEmergencyOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to toggle emergency stop",
      );
    } finally {
      setEmergencyLoading(false);
    }
  }

  async function handleTogglePause() {
    setPauseLoading(true);
    try {
      const response = await fetch("/api/v1/membership/pause-auto-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !autoApprovalsPaused }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to toggle auto-approval pause");
      }

      toast.success(
        autoApprovalsPaused
          ? "Auto-approvals resumed."
          : "Auto-approvals paused. All requests will require manual review.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to toggle auto-approval pause",
      );
    } finally {
      setPauseLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Personal auto-approval pause - available to everyone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {autoApprovalsPaused ? (
              <Pause className="size-5 text-amber-600" />
            ) : (
              <Play className="size-5 text-green-600" />
            )}
            Auto-Approval Pause
          </CardTitle>
          <CardDescription>
            Pause all automatic approvals (trust rules, approval rules, and
            time-based auto-actions) for your organization membership. While
            paused, every request will require manual review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {autoApprovalsPaused ? (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <Pause className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Auto-approvals are paused
                </p>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  All incoming requests will require manual approval until you
                  resume.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Auto-approvals are active
                </p>
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  Trust rules and approval rules are being evaluated normally.
                </p>
              </div>
            </div>
          )}

          <Button
            variant={autoApprovalsPaused ? "default" : "outline"}
            onClick={handleTogglePause}
            disabled={pauseLoading}
            className={`w-full ${!autoApprovalsPaused ? "bg-white dark:bg-zinc-900" : ""}`}
          >
            {pauseLoading && <Loader2 className="size-4 animate-spin" />}
            {autoApprovalsPaused
              ? "Resume Auto-Approvals"
              : "Pause Auto-Approvals"}
          </Button>
        </CardContent>
      </Card>

      {/* Emergency stop - admin only */}
      {isAdmin && (
        <Card className={emergencyStopActive ? "border-red-500" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle
                className={`size-5 ${emergencyStopActive ? "text-red-600" : "text-muted-foreground"}`}
              />
              Emergency Stop
            </CardTitle>
            <CardDescription>
              Immediately cancel all pending approvals and block new requests
              across the entire organization. This is a nuclear option, so use it
              only when something has gone seriously wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emergencyStopActive ? (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Emergency Stop is ACTIVE
                  </p>
                  {emergencyStopActivatedAt && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Activated at:{" "}
                      <span className="font-medium">
                        {new Date(emergencyStopActivatedAt).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {emergencyStopActivatedBy && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Activated by:{" "}
                      <span className="font-medium">
                        {emergencyStopActivatedBy}
                      </span>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                    All pending approvals have been cancelled. New requests are
                    blocked until deactivated.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    System is operating normally
                  </p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    Approval requests are being processed as expected.
                  </p>
                </div>
              </div>
            )}

            <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-14 w-full text-base font-bold"
                >
                  {emergencyStopActive
                    ? "DEACTIVATE EMERGENCY STOP"
                    : "ACTIVATE EMERGENCY STOP"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you sure?</DialogTitle>
                  <DialogDescription>
                    {emergencyStopActive
                      ? "This will allow new approval requests to be created again."
                      : "This will cancel ALL pending approvals and block new ones until deactivated."}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEmergencyOpen(false)}
                    disabled={emergencyLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleToggleEmergency}
                    disabled={emergencyLoading}
                  >
                    {emergencyLoading
                      ? "Processing..."
                      : emergencyStopActive
                        ? "Deactivate"
                        : "Activate Emergency Stop"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
