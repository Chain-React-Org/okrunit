"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TelegramConnectDialog } from "./telegram-connect-dialog";
import type { MessagingConnection } from "@/lib/types/database";

interface TelegramDeepLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (connection: MessagingConnection) => void;
}

type LinkState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; deepLink: string; nonce: string; botUsername: string; expiresAt: string }
  | { phase: "claimed"; chatTitle: string }
  | { phase: "expired" }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 2_000;

export function TelegramDeepLinkDialog({
  open,
  onOpenChange,
  onSuccess,
}: TelegramDeepLinkDialogProps) {
  const [state, setState] = useState<LinkState>({ phase: "idle" });
  const [showManual, setShowManual] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate a new deep link
  const generateLink = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/v1/messaging/telegram/start-link", {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate link");
      }

      const data = await res.json();
      setState({
        phase: "ready",
        deepLink: data.deep_link,
        nonce: data.nonce,
        botUsername: data.bot_username,
        expiresAt: data.expires_at,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to generate link",
      });
    }
  }, []);

  // Poll for link claim status
  useEffect(() => {
    if (state.phase !== "ready") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/v1/messaging/telegram/link-status?nonce=${state.nonce}`,
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "claimed") {
          setState({ phase: "claimed", chatTitle: data.chat_title ?? "Telegram Chat" });
          toast.success("Telegram connected successfully!");

          // Brief pause so the user sees the success state, then close + reload
          setTimeout(() => {
            onOpenChange(false);
            window.location.reload();
          }, 2200);
        } else if (data.status === "expired") {
          setState({ phase: "expired" });
        }
      } catch {
        // Ignore polling errors
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state, onOpenChange]);

  // Generate link when dialog opens
  useEffect(() => {
    if (open && state.phase === "idle") {
      generateLink();
    }
    if (!open) {
      setState({ phase: "idle" });
    }
  }, [open, state.phase, generateLink]);

  // Manual dialog handler
  if (showManual) {
    return (
      <TelegramConnectDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setShowManual(false);
          onOpenChange(v);
        }}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Telegram</DialogTitle>
          <DialogDescription>
            Open the link below in Telegram and press Start to connect this
            chat for approval notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2">
          {/* Loading */}
          {state.phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating link...</p>
            </div>
          )}

          {/* Ready - show QR + link */}
          {state.phase === "ready" && (
            <>
              <div className="rounded-xl border bg-white p-3">
                <QRCodeSVG
                  value={state.deepLink}
                  size={180}
                  level="M"
                  marginSize={0}
                />
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Scan the QR code with your phone, or click the button below:
                </p>

                <Button asChild className="gap-2">
                  <a
                    href={state.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" />
                    Open in Telegram
                  </a>
                </Button>

                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Waiting for you to press Start...
                </div>
              </div>
            </>
          )}

          {/* Claimed - success */}
          {state.phase === "claimed" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="size-10 text-green-500" />
              <div className="text-center">
                <p className="font-medium">Connected!</p>
                <p className="text-sm text-muted-foreground">
                  {state.chatTitle} will receive notifications.
                </p>
              </div>
            </div>
          )}

          {/* Expired */}
          {state.phase === "expired" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">
                This link has expired.
              </p>
              <Button variant="outline" onClick={generateLink} className="gap-2">
                <RefreshCw className="size-4" />
                Generate New Link
              </Button>
            </div>
          )}

          {/* Error */}
          {state.phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-destructive">{state.message}</p>
              <Button variant="outline" onClick={generateLink} className="gap-2">
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Advanced: manual bot token setup */}
        {state.phase !== "claimed" && (
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="size-3.5" />
              Use your own bot (advanced)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
