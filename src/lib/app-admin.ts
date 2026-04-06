// ---------------------------------------------------------------------------
// OKrunit -- App Admin Context Helper
// Server-side utility for verifying app-level admin access.
// ---------------------------------------------------------------------------

import { cache } from "react";
import { connection } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/lib/types/database";

/**
 * Get the current user's profile if they are an app admin.
 * Returns the profile when `is_app_admin` is true, otherwise null.
 * Cached per-request via React.cache.
 */
export const getAppAdminContext = cache(async (): Promise<UserProfile | null> => {
  await connection();
  const { user } = await getAuthUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single<UserProfile>();

  if (!profile || !profile.is_app_admin) return null;

  return profile;
});
