"use client";

// ---------------------------------------------------------------------------
// OKrunit -- OAuth Client List Component
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import type { UserRole } from "@/lib/types/database";

interface OAuthClientView {
  id: string;
  name: string;
  client_id: string;
  client_secret_prefix: string;
  redirect_uris: string[];
  scopes: string[];
  is_active: boolean;
  created_at: string;
}

interface OAuthClientListProps {
  clients: OAuthClientView[];
  role: UserRole;
}

export function OAuthClientList({ clients, role }: OAuthClientListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [secretDisplay, setSecretDisplay] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");

  const canManage = role === "owner" || role === "admin";

  async function handleCreate() {
    setCreating(true);
    try {
      const uris = redirectUris
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const response = await fetch("/api/v1/oauth/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          redirect_uris: uris,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSecretDisplay({
          clientId: data.data.client_id,
          clientSecret: data.client_secret,
        });
        setCreateOpen(false);
        setName("");
        setRedirectUris("");
        router.refresh();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/oauth/clients/${id}`, { method: "DELETE" });
    setDeleteOpen(null);
    router.refresh();
  }

  async function handleRotate(id: string) {
    setRotating(true);
    try {
      const response = await fetch(
        `/api/v1/oauth/clients/${id}/rotate-secret`,
        { method: "POST" },
      );
      const data = await response.json();
      if (response.ok) {
        setSecretDisplay({
          clientId: data.data.client_id,
          clientSecret: data.client_secret,
        });
        router.refresh();
      }
    } finally {
      setRotating(false);
      setRotateOpen(null);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Secret display dialog */}
      {secretDisplay && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              OAuth Client Created
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Copy these credentials now. The client secret will not be shown
              again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-sm dark:bg-black">
                  {secretDisplay.clientId}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(secretDisplay.clientId, "client_id")
                  }
                >
                  {copied === "client_id" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-3 py-2 text-sm dark:bg-black">
                  {secretDisplay.clientSecret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(
                      secretDisplay.clientSecret,
                      "client_secret",
                    )
                  }
                >
                  {copied === "client_secret" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setSecretDisplay(null)}
              className="mt-2"
            >
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header with create button */}
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New OAuth App
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register OAuth Application</DialogTitle>
                <DialogDescription>
                  Create a new OAuth 2.0 client for a third-party integration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Application Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Zapier Integration"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redirect_uris">
                    Redirect URIs (one per line)
                  </Label>
                  <textarea
                    id="redirect_uris"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="https://zapier.com/dashboard/auth/oauth/return/App12345CLIAPI/"
                    value={redirectUris}
                    onChange={(e) => setRedirectUris(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!name || !redirectUris || creating}
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Client list */}
      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">
              No OAuth applications registered yet.
            </p>
            {canManage && (
              <p className="text-muted-foreground text-xs mt-1">
                Create one to enable one-click integrations with Zapier, Make,
                and more.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {client.name}
                      {!client.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      Client ID: {client.client_id}
                    </CardDescription>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Dialog
                        open={rotateOpen === client.id}
                        onOpenChange={(open) =>
                          setRotateOpen(open ? client.id : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Rotate Client Secret</DialogTitle>
                            <DialogDescription>
                              This will generate a new secret for &ldquo;
                              {client.name}&rdquo; and revoke all existing
                              tokens. Any integrations using the old secret will
                              need to be reconnected.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setRotateOpen(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleRotate(client.id)}
                              disabled={rotating}
                            >
                              {rotating ? "Rotating..." : "Rotate Secret"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog
                        open={deleteOpen === client.id}
                        onOpenChange={(open) =>
                          setDeleteOpen(open ? client.id : null)
                        }
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete OAuth App</DialogTitle>
                            <DialogDescription>
                              This will revoke all tokens and permanently delete
                              &ldquo;{client.name}&rdquo;. This action cannot be
                              undone.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteOpen(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(client.id)}
                            >
                              Delete
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Secret Prefix
                  </p>
                  <code className="text-xs">
                    gks_{client.client_secret_prefix}...
                  </code>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Redirect URIs
                  </p>
                  <div className="space-y-1">
                    {client.redirect_uris.map((uri, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        <code className="text-xs truncate">{uri}</code>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Scopes</p>
                  <div className="flex flex-wrap gap-1">
                    {client.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Created{" "}
                    {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
