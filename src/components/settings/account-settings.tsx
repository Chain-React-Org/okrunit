"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Loader2, AlertTriangle, CheckCircle, Clock, Bell, ShieldCheck, SlidersHorizontal, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { NotificationSettings, ApprovalPriority } from "@/lib/types/database";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York (EST/EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
] as const;

const PRIORITY_OPTIONS: { value: ApprovalPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

interface AccountSettingsProps {
  userId: string;
  initialFullName: string;
  initialEmail: string;
  deletionScheduledAt?: string | null;
  notificationSettings: NotificationSettings | null;
}

export function AccountSettings({
  userId,
  initialFullName,
  initialEmail,
  deletionScheduledAt,
  notificationSettings,
}: AccountSettingsProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Profile
  const [fullName, setFullName] = useState(initialFullName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email change
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Password reset
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Notification preferences
  const [emailEnabled, setEmailEnabled] = useState(
    notificationSettings?.email_enabled ?? false
  );
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    notificationSettings?.quiet_hours_enabled ?? false
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    notificationSettings?.quiet_hours_start ?? "22:00"
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    notificationSettings?.quiet_hours_end ?? "08:00"
  );
  const [quietHoursTimezone, setQuietHoursTimezone] = useState(
    notificationSettings?.quiet_hours_timezone ?? "UTC"
  );
  const [minimumPriority, setMinimumPriority] = useState<ApprovalPriority>(
    notificationSettings?.minimum_priority ?? "low"
  );
  const [skipApprovalConfirmation, setSkipApprovalConfirmation] = useState(
    notificationSettings?.skip_approval_confirmation ?? false
  );

  // Delete account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isDeletionScheduled = !!deletionScheduledAt;
  const deletionDate = deletionScheduledAt ? new Date(deletionScheduledAt) : null;

  // -- Profile save --

  async function handleSaveProfile() {
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", userId);
      if (profileError) throw profileError;

      toast.success("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  // -- Email change --

  async function handleSendEmailChange() {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) throw error;

      setEmailSent(true);
      setNewEmail("");
      setShowEmailForm(false);
      toast.success("Confirmation email sent to both addresses.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send confirmation email."
      );
    } finally {
      setIsSendingEmail(false);
    }
  }

  // -- Password reset --

  async function handleSendPasswordReset() {
    setIsSendingReset(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        initialEmail,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (error) throw error;

      setPasswordResetSent(true);
      toast.success("Password reset link sent to your email.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send reset link."
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  // -- Auto-save notification preferences (debounced) --

  const notifDirty = useRef(false);
  const notifSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        user_id: user.id,
        email_enabled: emailEnabled,
        quiet_hours_enabled: quietHoursEnabled,
        quiet_hours_start: quietHoursEnabled ? quietHoursStart : null,
        quiet_hours_end: quietHoursEnabled ? quietHoursEnd : null,
        quiet_hours_timezone: quietHoursEnabled ? quietHoursTimezone : null,
        minimum_priority: minimumPriority,
        skip_approval_confirmation: skipApprovalConfirmation,
      };

      const { error } = await supabase
        .from("notification_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
      toast.success("Settings saved");
    } catch (err) {
      console.error("Failed to save notification settings:", err);
      toast.error("Failed to save settings. Please try again.");
    }
  }, [emailEnabled, quietHoursEnabled, quietHoursStart, quietHoursEnd, quietHoursTimezone, minimumPriority, skipApprovalConfirmation]);

  useEffect(() => {
    if (!notifDirty.current) return;
    if (notifSaveTimeout.current) clearTimeout(notifSaveTimeout.current);
    notifSaveTimeout.current = setTimeout(() => { saveNotifications(); }, 600);
    return () => { if (notifSaveTimeout.current) clearTimeout(notifSaveTimeout.current); };
  }, [saveNotifications]);

  // Wrap setters to mark dirty on user interaction
  const setEmailEnabledDirty = useCallback((v: boolean) => { notifDirty.current = true; setEmailEnabled(v); }, []);
  const setQuietHoursEnabledDirty = useCallback((v: boolean) => { notifDirty.current = true; setQuietHoursEnabled(v); }, []);
  const setQuietHoursStartDirty = useCallback((v: string) => { notifDirty.current = true; setQuietHoursStart(v); }, []);
  const setQuietHoursEndDirty = useCallback((v: string) => { notifDirty.current = true; setQuietHoursEnd(v); }, []);
  const setQuietHoursTimezoneDirty = useCallback((v: string) => { notifDirty.current = true; setQuietHoursTimezone(v); }, []);
  const setMinimumPriorityDirty = useCallback((v: ApprovalPriority) => { notifDirty.current = true; setMinimumPriority(v); }, []);
  const setSkipApprovalConfirmationDirty = useCallback((v: boolean) => { notifDirty.current = true; setSkipApprovalConfirmation(v); }, []);

  // -- Request deletion (sends email) --

  async function handleRequestDeletion() {
    setIsRequesting(true);
    try {
      const res = await fetch("/api/v1/account/delete", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send confirmation email");
      }

      setDeletionRequested(true);
      setShowDeleteDialog(false);
      toast.success("Confirmation email sent. Check your inbox.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to request deletion."
      );
    } finally {
      setIsRequesting(false);
    }
  }

  // -- Cancel scheduled deletion --

  async function handleCancelDeletion() {
    setIsCancelling(true);
    try {
      const res = await fetch("/api/v1/account/delete/cancel", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to cancel deletion");
      }

      toast.success("Account deletion cancelled.");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel deletion."
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Deletion scheduled banner */}
      {isDeletionScheduled && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <Clock className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              Your account is scheduled for deletion
            </p>
            <p className="text-xs text-red-600 mt-1">
              Your account and all data will be permanently deleted on{" "}
              <strong>
                {deletionDate?.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
              . You can cancel this at any time before then.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancelDeletion}
            disabled={isCancelling}
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
          >
            {isCancelling && <Loader2 className="size-4 animate-spin" />}
            Cancel deletion
          </Button>
        </div>
      )}

      {/* -- Profile -- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your personal information associated with this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile && <Loader2 className="size-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* -- Email -- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            The email address used to sign in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{initialEmail}</p>
              <p className="text-xs text-muted-foreground">Current email address</p>
            </div>
            {emailSent ? (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="size-4" />
                Check your email
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailForm(!showEmailForm)}
              >
                Change email
              </Button>
            )}
          </div>

          {showEmailForm && (
            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-email">New email address</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="new-email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A confirmation link will be sent to both your current and new email address.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEmailForm(false);
                    setNewEmail("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendEmailChange}
                  disabled={isSendingEmail || !newEmail.trim()}
                >
                  {isSendingEmail && <Loader2 className="size-4 animate-spin" />}
                  Send confirmation
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -- Password -- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Password
          </CardTitle>
          <CardDescription>
            Manage your account password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Reset your password</p>
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a password reset link to your email address.
              </p>
            </div>
            {passwordResetSent ? (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="size-4" />
                Check your email
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendPasswordReset}
                disabled={isSendingReset}
              >
                {isSendingReset && <Loader2 className="size-4 animate-spin" />}
                Send reset link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -- Appearance -- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="size-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose your preferred theme for the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* -- Notification Preferences -- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            These settings control notifications sent directly to you — like
            emails when a new approval request is created or decided. Org-wide
            messaging channels (Slack, Discord, etc.) are configured separately
            under Messaging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="email-toggle" className="text-sm font-medium">
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Switch
              id="email-toggle"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabledDirty}
            />
          </div>

          <Separator />

          {/* Quiet Hours */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="size-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="quiet-hours-toggle" className="text-sm font-medium">
                  Quiet hours
                </Label>
                <p className="text-xs text-muted-foreground">
                  Suppress non-critical notifications during specified hours
                </p>
              </div>
            </div>
            <Switch
              id="quiet-hours-toggle"
              checked={quietHoursEnabled}
              onCheckedChange={setQuietHoursEnabledDirty}
            />
          </div>

          {quietHoursEnabled && (
            <div className="ml-7 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStartDirty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEndDirty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-timezone">Timezone</Label>
                <Select
                  value={quietHoursTimezone}
                  onValueChange={setQuietHoursTimezoneDirty}
                >
                  <SelectTrigger id="quiet-timezone" className="w-full">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Separator />

          {/* Priority threshold */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Minimum priority</Label>
                <p className="text-xs text-muted-foreground">
                  Only notify for approvals at or above this level
                </p>
              </div>
            </div>
            <Select
              value={minimumPriority}
              onValueChange={(val) => setMinimumPriorityDirty(val as ApprovalPriority)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Skip confirmation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="skip-confirmation-toggle" className="text-sm font-medium">
                  Skip confirmation dialog
                </Label>
                <p className="text-xs text-muted-foreground">
                  Approve or reject with a single click
                </p>
              </div>
            </div>
            <Switch
              id="skip-confirmation-toggle"
              checked={skipApprovalConfirmation}
              onCheckedChange={setSkipApprovalConfirmationDirty}
            />
          </div>

        </CardContent>
      </Card>

      {/* -- Danger Zone -- */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
                {isDeletionScheduled
                  ? "Your account is currently scheduled for deletion."
                  : "We\u2019ll send a confirmation email. Your account will have a 30-day recovery period before permanent deletion."}
              </p>
            </div>
            {deletionRequested ? (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle className="size-4" />
                Check your email
              </div>
            ) : isDeletionScheduled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDeletion}
                disabled={isCancelling}
              >
                {isCancelling && <Loader2 className="size-4 animate-spin" />}
                Cancel deletion
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -- Delete confirmation dialog -- */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                We&apos;ll send a confirmation email to <strong className="text-foreground">{initialEmail}</strong>.
                You must click the link in the email to confirm.
              </span>
              <span className="block">
                After confirmation, your account will enter a <strong className="text-foreground">30-day recovery period</strong>.
                During this time you can sign in and cancel the deletion. After 30 days,
                your account and all data will be permanently removed.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={isRequesting}
            >
              {isRequesting && <Loader2 className="size-4 animate-spin" />}
              Send confirmation email
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
