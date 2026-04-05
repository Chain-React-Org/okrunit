"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StepLayout } from "./step-layout";
import { Key, Copy, Check, Terminal } from "lucide-react";

interface CreateConnectionStepProps {
  existingConnectionId?: string;
  existingApiKey?: string;
  onComplete: (connectionId: string, apiKey: string) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function CreateConnectionStep({
  existingConnectionId,
  existingApiKey,
  onComplete,
  onBack,
  onSkip,
}: CreateConnectionStepProps) {
  const [name, setName] = useState("My First Connection");
  const [apiKey, setApiKey] = useState(existingApiKey ?? "");
  const [connectionId, setConnectionId] = useState(existingConnectionId ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasKey = !!apiKey;

  function handleGenerate() {
    if (!name.trim()) {
      setError("Connection name is required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to create connection.");
          return;
        }

        const data = await res.json();
        setApiKey(data.api_key);
        setConnectionId(data.connection.id);
      } catch {
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNext() {
    onComplete(connectionId, apiKey);
  }

  const curlSnippet = `curl -X POST https://app.okrunit.com/api/v1/approvals \\
  -H "Authorization: Bearer ${apiKey || "ok_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My first approval", "priority": "medium"}'`;

  return (
    <StepLayout
      stepNumber={4}
      totalSteps={5}
      title="Create an API connection"
      description="Generate an API key so your automations can send approval requests to OKrunit."
      onBack={onBack}
      onNext={hasKey ? handleNext : undefined}
      onSkip={onSkip}
      showSkip
      nextLabel="Continue"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">API key connection</p>
            <p className="text-xs text-muted-foreground">
              Use this key in your automation tool or custom integration. The key
              is only shown once.
            </p>
          </div>
        </div>

        {!hasKey ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="connection-name">Connection name</Label>
              <Input
                id="connection-name"
                type="text"
                placeholder="e.g., Production CI/CD"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>

            <Button onClick={handleGenerate} disabled={isPending || !name.trim()}>
              <Key className="size-4" />
              {isPending ? "Generating..." : "Generate API Key"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* API Key display */}
            <div className="space-y-2">
              <Label>Your API key</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border bg-muted px-3 py-2 font-mono text-xs">
                  {apiKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy API key"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Save this key now -- it will not be shown again.
              </p>
            </div>

            {/* Code snippet */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-muted-foreground" />
                <Label>Example usage</Label>
              </div>
              <pre className="overflow-x-auto rounded-lg border bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                {curlSnippet}
              </pre>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
    </StepLayout>
  );
}
