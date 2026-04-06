// ---------------------------------------------------------------------------
// Cache tag constants and helpers for use-cache / revalidateTag
// ---------------------------------------------------------------------------

import { revalidateTag } from "next/cache";

// Tag factories — each returns a deterministic string for cacheTag / revalidateTag
export const CacheTags = {
  orgContext: (userId: string) => `user:${userId}:org-context`,
  dashboard: (userId: string) => `user:${userId}:dashboard`,
  overview: (orgId: string) => `org:${orgId}:overview`,
  members: (orgId: string) => `org:${orgId}:members`,
  teams: (orgId: string) => `org:${orgId}:teams`,
  settings: (orgId: string) => `org:${orgId}:settings`,
  roles: (orgId: string) => `org:${orgId}:roles`,
  subscription: (orgId: string) => `org:${orgId}:subscription`,
  organizations: (userId: string) => `user:${userId}:organizations`,
  requests: (orgId: string) => `org:${orgId}:requests`,
  analytics: (orgId: string) => `org:${orgId}:analytics`,
  connections: (orgId: string) => `org:${orgId}:connections`,
  rules: (orgId: string) => `org:${orgId}:rules`,
  routes: (orgId: string) => `org:${orgId}:routes`,
  sla: (orgId: string) => `org:${orgId}:sla`,
  auditLog: (orgId: string) => `org:${orgId}:audit-log`,
  account: (userId: string) => `user:${userId}:account`,
  notifications: (userId: string) => `user:${userId}:notifications`,
  messaging: (orgId: string) => `org:${orgId}:messaging`,
  oauth: (orgId: string) => `org:${orgId}:oauth`,
} as const;

// Convenience: invalidate multiple tags at once
export function revalidateTags(...tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, "minutes");
  }
}
