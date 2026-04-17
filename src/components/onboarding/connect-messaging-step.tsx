"use client";

import { StepLayout } from "./step-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, MessageSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

interface PlatformDef {
  id: string;
  name: string;
  logo: string;
  connectUrl: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "slack",
    name: "Slack",
    logo: "/logos/platforms/slack.png",
    connectUrl: "/api/v1/messaging/slack/install?from=setup",
  },
  {
    id: "discord",
    name: "Discord",
    logo: "/logos/platforms/discord.png",
    connectUrl: "/api/v1/messaging/discord/install?from=setup",
  },
  {
    id: "teams",
    name: "Teams",
    logo: "/logos/platforms/teams.png",
    connectUrl: "/api/v1/messaging/teams/install?from=setup",
  },
  {
    id: "telegram",
    name: "Telegram",
    logo: "/logos/platforms/telegram.png",
    connectUrl: "/api/v1/messaging/telegram/install?from=setup",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConnectMessagingStepProps {
  connectedPlatforms: string[];
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function ConnectMessagingStep({
  connectedPlatforms,
  onComplete,
  onBack,
  onSkip,
}: ConnectMessagingStepProps) {
  const hasAnyConnection = connectedPlatforms.length > 0;

  return (
    <StepLayout
      stepNumber={3}
      totalSteps={3}
      title="Connect messaging"
      description="Connect a messaging platform to receive approval notifications where your team already works."
      onBack={onBack}
      onNext={hasAnyConnection ? onComplete : undefined}
      onSkip={onSkip}
      showSkip
      nextLabel="Continue"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Notification channels</p>
            <p className="text-xs text-muted-foreground">
              Connect one or more platforms. You can manage channels later in Messaging settings.
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2">
          {PLATFORMS.map((platform) => {
            const isConnected = connectedPlatforms.includes(platform.id);

            return (
              <div
                key={platform.id}
                className="flex flex-col items-center gap-3 rounded-xl border p-5 text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={platform.logo}
                  alt={platform.name}
                  className="size-10 object-contain"
                />
                <p className="text-sm font-medium whitespace-nowrap">{platform.name}</p>
                {isConnected ? (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                  >
                    <Check className="size-3" />
                    Connected
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="w-full bg-white dark:bg-card" asChild>
                    <a href={platform.connectUrl}>
                      Connect
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </StepLayout>
  );
}
