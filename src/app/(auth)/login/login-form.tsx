"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectUrl } from "@/lib/redirect";
import { checkMfaRequired } from "@/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialLoginButtons, LAST_PROVIDER_KEY } from "@/components/auth/social-login-buttons";

const ERROR_MESSAGES: Record<string, string> = {
  no_org:
    "Your account is not associated with any organization. Please contact your administrator or sign up for a new account.",
  sso_email_required: "Please enter your email address to sign in with SSO.",
  sso_not_configured:
    "SSO is not configured for your email domain. Please sign in with email and password.",
  saml_response_missing: "Invalid SSO response. Please try again.",
  saml_validation_failed:
    "SSO authentication failed. The identity provider response could not be verified.",
  saml_no_email:
    "Your identity provider did not return an email address. Please contact your IT admin.",
  saml_user_creation_failed: "Failed to create your account via SSO. Please try again.",
  saml_session_failed: "Failed to establish a session after SSO login. Please try again.",
  saml_error: "An unexpected error occurred during SSO login. Please try again.",
  invalid_verification_link: "Invalid or expired verification link. Please request a new one.",
  verification_failed: "Email verification failed. The link may have expired, please try signing up again.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inviteToken = searchParams.get("invite");

  const [showSso, setShowSso] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLastProvider(localStorage.getItem(LAST_PROVIDER_KEY));
    } catch {}
  }, []);

  // Show error from redirect (e.g. no org membership, SSO errors) and sign out stale session
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
      // Sign out the stale session so the user doesn't keep looping
      if (errorCode === "no_org") {
        const supabase = createClient();
        supabase.auth.signOut();
      }
    }
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();

      // Check if SSO is enforced for this email domain
      try {
        const checkRes = await fetch("/api/v1/auth/check-sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const checkData = await checkRes.json();
        if (checkData.enforce_sso) {
          setError(
            `Your organization requires SSO login. Please use the "Sign in with SSO" option below.`,
          );
          setShowSso(true);
          setSsoEmail(email);
          return;
        }
      } catch {
        // If the check fails, allow normal login to proceed
      }

      try {
        localStorage.setItem(LAST_PROVIDER_KEY, "email");
      } catch {}

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Check if user has MFA enrolled. Redirect to verification if so
      const { required } = await checkMfaRequired(supabase);
      const redirectTo = searchParams.get("redirect_to");

      if (required) {
        const mfaUrl = `/mfa-verify${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`;
        router.push(mfaUrl);
        return;
      }

      // If there's an invite token, route to the invite acceptance page
      // so the user gets added to the invited org.
      if (inviteToken) {
        router.push(`/invite/${inviteToken}`);
        return;
      }

      // If there's a redirect_to param (e.g. from OAuth authorize), go there instead.
      // Validate it's a safe relative path to prevent open redirect attacks.
      router.push(safeRedirectUrl(redirectTo));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to sign in to your account
        </p>
      </div>

      <SocialLoginButtons mode="login" inviteToken={inviteToken} disabled={isPending} />

      <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="email">Email</Label>
            {lastProvider === "email" && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                Last used
              </span>
            )}
          </div>
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isPending}
          />
        </div>

        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {/* SSO Login */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {showSso ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sso-email">Work email</Label>
            <Input
              id="sso-email"
              type="email"
              placeholder="you@company.com"
              value={ssoEmail}
              onChange={(e) => setSsoEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setShowSso(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!ssoEmail.includes("@")}
              onClick={() => {
                try {
                  localStorage.setItem(LAST_PROVIDER_KEY, "sso");
                } catch {}
                window.location.href = `/api/auth/saml/login?email=${encodeURIComponent(ssoEmail)}`;
              }}
            >
              Continue with SSO
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowSso(true)}
        >
          <span>Sign in with SSO</span>
          {lastProvider === "sso" && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              Last used
            </span>
          )}
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
