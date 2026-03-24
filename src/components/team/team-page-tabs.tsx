"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberList } from "@/components/team/member-list";
import { InviteForm } from "@/components/team/invite-form";
import { PendingInvites } from "@/components/team/pending-invites";
import { TeamList } from "@/components/teams/team-list";
import { OrgSettingsForm } from "@/components/organization/org-settings-form";
import { Users, Mail, UsersRound, Building2 } from "lucide-react";
import type { OrgInvite, Organization, UserRole } from "@/lib/types/database";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  can_approve: boolean;
  created_at: string;
  updated_at: string;
}

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamMembershipData {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

interface OrgMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  can_approve: boolean;
}

export interface MemberActivityStats {
  decisions_30d: number;
  approved: number;
  rejected: number;
  last_active: string | null;
}

interface TeamPageTabsProps {
  members: TeamMember[];
  currentUserId: string;
  currentUserRole: string;
  canManageInvites: boolean;
  pendingInvites: OrgInvite[];
  teams: TeamData[];
  memberCounts: Record<string, number>;
  teamMemberships: TeamMembershipData[];
  orgMembers: OrgMember[];
  org: Organization;
  memberCount: number;
  memberStats: Record<string, MemberActivityStats>;
  pendingLoadMap: Record<string, number>;
}

export function TeamPageTabs({
  members,
  currentUserId,
  currentUserRole,
  canManageInvites,
  pendingInvites,
  teams,
  memberCounts,
  teamMemberships,
  orgMembers,
  org,
  memberCount,
  memberStats,
  pendingLoadMap,
}: TeamPageTabsProps) {
  return (
    <Tabs defaultValue="members" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="members" className="gap-1.5">
          <Users className="size-3.5" />
          Members
        </TabsTrigger>
        {canManageInvites && (
          <TabsTrigger value="invites" className="gap-1.5">
            <Mail className="size-3.5" />
            Invites
            {pendingInvites.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {pendingInvites.length}
              </span>
            )}
          </TabsTrigger>
        )}
        <TabsTrigger value="groups" className="gap-1.5">
          <UsersRound className="size-3.5" />
          Team Groups
        </TabsTrigger>
        <TabsTrigger value="organization" className="gap-1.5">
          <Building2 className="size-3.5" />
          Organization
        </TabsTrigger>
      </TabsList>

      <TabsContent value="members">
        <MemberList
          members={members}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          memberStats={memberStats}
          pendingLoadMap={pendingLoadMap}
        />
      </TabsContent>

      {canManageInvites && (
        <TabsContent value="invites">
          <div className="space-y-6">
            <InviteForm />
            {pendingInvites.length > 0 && (
              <PendingInvites
                invites={pendingInvites}
                canManage={canManageInvites}
              />
            )}
          </div>
        </TabsContent>
      )}

      <TabsContent value="groups">
        <TeamList
          teams={teams}
          memberCounts={memberCounts}
          teamMemberships={teamMemberships}
          orgMembers={orgMembers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </TabsContent>

      <TabsContent value="organization">
        <OrgSettingsForm
          org={org}
          role={currentUserRole as UserRole}
          memberCount={memberCount}
        />
      </TabsContent>
    </Tabs>
  );
}
