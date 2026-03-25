"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${APP_URL}/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
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
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong>{email}</strong>. Click the
            link to reset your password.
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isPending}
          />
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending ? "Sending reset link..." : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
