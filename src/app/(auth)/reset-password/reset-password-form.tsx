"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Password updated
          </h1>
          <p className="text-sm text-muted-foreground">
            Your password has been successfully reset. You can now sign in with
            your new password.
          </p>
        </div>

        <Link href="/login" className="w-full">
          <Button className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending ? "Updating password..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
