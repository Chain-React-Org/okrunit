// ---------------------------------------------------------------------------
// OKrunit -- Organization Context Helper
// Server-side utilities for resolving the active org for the current user.
// ---------------------------------------------------------------------------

import { cache } from "react";
import { connection } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getCachedOrgData } from "@/lib/cache/queries";
import type { OrgMembership, Organization, UserProfile } from "@/lib/types/database";

export interface OrgContext {
  profile: UserProfile;
  membership: OrgMembership;
  org: Organization;
}

/**
 * Get the current user's active org context.
 * React.cache deduplicates within a single request; the inner DB queries
 * are further cached across requests via "use cache" in getCachedOrgData.
 */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  await connection();
  const { user } = await getAuthUser();
  if (!user) return null;
  return getCachedOrgData(user.id);
});
