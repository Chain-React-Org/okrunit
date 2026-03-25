"use client";

// ---------------------------------------------------------------------------
// OKRunit -- Account Settings
// ---------------------------------------------------------------------------
// Profile, email, password, and account deletion management.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { User, Mail, Lock, Loader2, AlertTriangle } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccountSettingsProps {
  userId: string;
  initialFullName: string;
  initialEmail: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountSettings({
  userId,
  initialFullName,
  initialEmail,
}: AccountSettingsProps) {
  // Profile
  const [fullName, setFullName] = useState(initialFullName);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // ---------------------------------------------------------------------------
  // Profile save
  // ---------------------------------------------------------------------------

  async function handleSaveProfile() {
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const supabase = createClient();

      // Update Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (authError) {
        throw authError;
      }

      // Update user_profiles table
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      toast.success("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Email change
  // ---------------------------------------------------------------------------

  async function handleChangeEmail() {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address.");
      return;
    }

    setIsSavingEmail(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) {
        throw error;
      }

      toast.success(
        "Confirmation email sent. Please check both your current and new email to confirm the change."
      );
      setNewEmail("");
    } catch (err) {
      console.error("Failed to update email:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update email. Please try again."
      );
    } finally {
      setIsSavingEmail(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Password change
  // ---------------------------------------------------------------------------

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const supabase = createClient();

      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: initialEmail,
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect.");
        return;
      }

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Failed to change password:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to change password. Please try again."
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ---- Profile ---- */}
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

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={initialEmail} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">
              To change your email, use the section below.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile && <Loader2 className="size-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Change Email ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Change Email
          </CardTitle>
          <CardDescription>
            Update the email address associated with your account. A
            confirmation email will be sent to both your current and new address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex justify-end">
            <Button onClick={handleChangeEmail} disabled={isSavingEmail}>
              {isSavingEmail && <Loader2 className="size-4 animate-spin" />}
              Update email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Change Password ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password. You&apos;ll need to enter your current
            password for verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={isSavingPassword}>
              {isSavingPassword && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---- Danger Zone ---- */}
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
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" disabled>
              Contact support
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            To delete your account, please contact support at{" "}
            <a
              href="mailto:support@okrunit.com"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              support@okrunit.com
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
