"use client";

import { SectionNav } from "@/components/ui/section-nav";
import { AccountSettings } from "@/components/settings/account-settings";
import { SafetySettings } from "@/components/settings/safety-settings";
import { User, Settings, AlertTriangle } from "lucide-react";
import type { SectionNavItem } from "@/components/ui/section-nav";
import type { NotificationSettings } from "@/lib/types/database";

interface SettingsLayoutProps {
  userId: string;
  initialFullName: string;
  initialEmail: string;
  initialAvatarUrl: string | null;
  deletionScheduledAt?: string | null;
  notificationSettings: NotificationSettings | null;
  isAdmin: boolean;
  orgId: string;
  emergencyStopActive: boolean;
  emergencyStopActivatedAt: string | null;
  emergencyStopActivatedBy: string | null;
  autoApprovalsPaused: boolean;
  initialSection?: string;
}

export function SettingsLayout({
  userId,
  initialFullName,
  initialEmail,
  initialAvatarUrl,
  deletionScheduledAt,
  notificationSettings,
  isAdmin,
  orgId,
  emergencyStopActive,
  emergencyStopActivatedAt,
  emergencyStopActivatedBy,
  autoApprovalsPaused,
  initialSection,
}: SettingsLayoutProps) {
  const items: SectionNavItem[] = [
    { id: "account", label: "Account", icon: User },
    { id: "safety", label: "Safety", icon: AlertTriangle },
  ];

  return (
    <SectionNav items={items} defaultSection={initialSection ?? "account"} title="Settings" titleIcon={Settings}>
      {(section) => (
        <>
          {section === "account" && (
            <AccountSettings
              userId={userId}
              initialFullName={initialFullName}
              initialEmail={initialEmail}
              initialAvatarUrl={initialAvatarUrl}
              deletionScheduledAt={deletionScheduledAt}
              notificationSettings={notificationSettings}
            />
          )}

          {section === "safety" && (
            <SafetySettings
              isAdmin={isAdmin}
              emergencyStopActive={emergencyStopActive}
              emergencyStopActivatedAt={emergencyStopActivatedAt}
              emergencyStopActivatedBy={emergencyStopActivatedBy}
              orgId={orgId}
              autoApprovalsPaused={autoApprovalsPaused}
            />
          )}

        </>
      )}
    </SectionNav>
  );
}
