"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkMfaRequired, verifyMfaCode } from "@/lib/mfa";
import { safeRedirectUrl } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { required, factorId: fid } = await checkMfaRequired(supabase);

      if (!required || !fid) {
        // No MFA needed, go to dashboard
        router.replace(safeRedirectUrl(searchParams.get("redirect_to")));
        return;
      }

      setFactorId(fid);
      setChecking(false);
    }
    check();
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const result = await verifyMfaCode(supabase, factorId, code);

    if (result.error) {
      setError("Invalid code. Please try again.");
      setVerifying(false);
      return;
    }

    const redirectTo = searchParams.get("redirect_to");
    router.push(safeRedirectUrl(redirectTo));
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-xl bg-primary/10 p-3">
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="mfa-code">Authentication code</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoComplete="one-time-code"
            autoFocus
            disabled={verifying}
          />
        </div>

        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={code.length !== 6 || verifying}
        >
          {verifying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) to view your code.
      </p>
    </div>
  );
}
