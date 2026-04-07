"use client";

// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Consent Form
// ---------------------------------------------------------------------------

import { useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0]?.toUpperCase() || "?";
}

const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  "approvals:read": {
    label: "Read Approvals",
    description: "View approval requests and their details",
  },
  "approvals:write": {
    label: "Write Approvals",
    description: "Create, approve, and reject approval requests",
  },
  "comments:write": {
    label: "Write Comments",
    description: "Add comments to approval requests",
  },
};

interface OrgOption {
  id: string;
  name: string;
  role: string;
}

interface ConsentFormProps {
  clientName: string;
  clientLogoUrl: string | null;
  orgName: string;
  scopes: string[];
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  userId: string;
  orgId: string;
  userEmail: string;
  userFullName: string | null;
  userAvatarUrl: string | null;
  orgOptions?: OrgOption[];
}

export function ConsentForm({
  clientName,
  clientLogoUrl,
  orgName,
  scopes,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  codeChallengeMethod,
  userId,
  orgId: defaultOrgId,
  userEmail,
  userFullName,
  userAvatarUrl,
  orgOptions,
}: ConsentFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(defaultOrgId);
  const selectedOrgName = orgOptions?.find((o) => o.id === selectedOrgId)?.name ?? orgName;

  async function handleAuthorize() {
    setLoading(true);

    try {
      const response = await fetch("/api/v1/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scopes,
          state,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
          user_id: userId,
          org_id: selectedOrgId,
        }),
      });

      const data = await response.json();

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        console.error("No redirect URL in response:", data);
        setLoading(false);
      }
    } catch (err) {
      console.error("Authorization failed:", err);
      setLoading(false);
    }
  }

  function handleDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "The user denied the request.");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <Card className="w-full">
      {/* Logged-in account indicator */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Avatar className="size-6">
          {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt="" />}
          <AvatarFallback className="!bg-primary text-[9px] font-bold !text-white">
            {getInitials(userFullName, userEmail)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          {userFullName && (
            <span className="text-sm font-medium leading-tight truncate">{userFullName}</span>
          )}
          <span className="text-xs text-muted-foreground leading-tight truncate">{userEmail}</span>
        </div>
      </div>

      <CardHeader className="px-4 pb-2 pt-3 text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          Authorize{" "}
          {clientLogoUrl ? (
            <Image
              src={clientLogoUrl}
              alt={clientName}
              width={24}
              height={24}
              className="inline-block h-6 w-auto"
            />
          ) : (
            clientName
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          <strong>{clientName}</strong> is requesting access to{" "}
          <strong>{selectedOrgName}</strong> on OKrunit.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2.5 px-4">
        {/* Org selector - only shown when user belongs to multiple orgs */}
        {orgOptions && orgOptions.length > 1 && (
          <div className="rounded-lg border bg-muted/30 p-2.5">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Connect to organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full rounded-md border bg-white dark:bg-card px-2.5 py-1.5 text-sm"
            >
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs font-medium">
          This will allow <strong>{clientName}</strong> to:
        </p>

        <ul className="space-y-1.5">
          {scopes.map((scope) => {
            const info = SCOPE_LABELS[scope];
            return (
              <li
                key={scope}
                className="flex items-start gap-2.5 rounded-lg border p-2"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium leading-tight">
                    {info?.label || scope}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {info?.description || scope}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      <CardFooter className="flex gap-3 px-4 pb-4 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleDeny}
          disabled={loading}
        >
          <X className="h-4 w-4" />
          Deny
        </Button>
        <Button
          className="flex-1"
          onClick={handleAuthorize}
          disabled={loading}
        >
          {loading ? "Authorizing..." : "Authorize"}
        </Button>
      </CardFooter>
    </Card>
  );
}
