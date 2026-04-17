// ---------------------------------------------------------------------------
// OKrunit -- Cron: Check Calendar OOO for Auto-Delegation
// ---------------------------------------------------------------------------
// Runs every 15 minutes. For each active calendar connection with an
// auto_delegate_to target, checks if the user is currently out-of-office.
// If OOO, creates a delegation. If no longer OOO, deactivates any
// auto-created delegation.
//
// Auth: x-cron-secret header
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import {
  createDelegation,
  getActiveDelegation,
  cancelDelegation,
} from "@/lib/api/delegation";
import { captureError } from "@/lib/monitoring/capture";
import { logger } from "@/lib/monitoring/logger";

// ---- Types ----------------------------------------------------------------

interface CalendarConnection {
  id: string;
  user_id: string;
  org_id: string;
  provider: "google" | "microsoft";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  auto_delegate_to: string | null;
}

interface OOOResult {
  isOOO: boolean;
  endTime: string | null;
}

// ---- Token refresh --------------------------------------------------------

async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  try {
    const res = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          scope: "Calendars.Read offline_access",
        }),
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function ensureValidToken(
  conn: CalendarConnection,
): Promise<string | null> {
  const admin = createAdminClient();

  // Check if token is still valid (with 5-minute buffer)
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime();
    if (expiresAt > Date.now() + 5 * 60 * 1000) {
      return conn.access_token;
    }
  }

  // Token is expired or about to expire, try to refresh
  if (!conn.refresh_token) return null;

  const refreshed =
    conn.provider === "google"
      ? await refreshGoogleToken(conn.refresh_token)
      : await refreshMicrosoftToken(conn.refresh_token);

  if (!refreshed) return null;

  // Store the new token
  await admin
    .from("calendar_connections")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  return refreshed.access_token;
}

// ---- OOO checking ---------------------------------------------------------

async function checkGoogleOOO(accessToken: string): Promise<OOOResult> {
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    timeMin: now,
    timeMax: now,
    eventTypes: "outOfOffice",
    singleEvents: "true",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return { isOOO: false, endTime: null };

  const data = await res.json();
  const items = data.items ?? [];

  if (items.length === 0) return { isOOO: false, endTime: null };

  // Find the OOO event with the latest end time
  let latestEnd: string | null = null;
  for (const event of items) {
    const end = event.end?.dateTime ?? event.end?.date;
    if (end && (!latestEnd || end > latestEnd)) {
      latestEnd = end;
    }
  }

  return { isOOO: true, endTime: latestEnd };
}

async function checkMicrosoftOOO(accessToken: string): Promise<OOOResult> {
  const now = new Date();
  const params = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: now.toISOString(),
    $filter: "showAs eq 'oof'",
    $top: "5",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return { isOOO: false, endTime: null };

  const data = await res.json();
  const events = data.value ?? [];

  if (events.length === 0) return { isOOO: false, endTime: null };

  // Find the OOO event with the latest end time
  let latestEnd: string | null = null;
  for (const event of events) {
    const end = event.end?.dateTime;
    if (end && (!latestEnd || end > latestEnd)) {
      latestEnd = end;
    }
  }

  return { isOOO: true, endTime: latestEnd };
}

// ---- GET handler ----------------------------------------------------------

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch all active calendar connections that have a delegate configured
  const { data: connections, error } = await admin
    .from("calendar_connections")
    .select("*")
    .eq("is_active", true)
    .not("auto_delegate_to", "is", null);

  if (error) {
    captureError({
      error: new Error(`Failed to fetch calendar connections: ${error.message}`),
      service: "calendar-ooo-cron",
      severity: "error",
    });
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ processed: 0, delegations_created: 0, delegations_removed: 0 });
  }

  let delegationsCreated = 0;
  let delegationsRemoved = 0;

  for (const conn of connections as CalendarConnection[]) {
    try {
      if (!conn.auto_delegate_to) continue;

      // Ensure we have a valid access token
      const accessToken = await ensureValidToken(conn);
      if (!accessToken) {
        logger.warn(`[Calendar OOO] Could not get valid token for connection ${conn.id}`);
        continue;
      }

      // Check OOO status
      const oooResult =
        conn.provider === "google"
          ? await checkGoogleOOO(accessToken)
          : await checkMicrosoftOOO(accessToken);

      // Check for existing auto-created delegation
      const existingDelegation = await getActiveDelegation(conn.org_id, conn.user_id);

      if (oooResult.isOOO) {
        // User is OOO. Create delegation if one doesn't already exist.
        if (!existingDelegation) {
          const endsAt = oooResult.endTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await createDelegation(
            conn.org_id,
            conn.user_id,
            conn.auto_delegate_to,
            "Auto-delegated: out-of-office detected from calendar",
            new Date().toISOString(),
            endsAt,
          );
          delegationsCreated++;
        }
      } else {
        // User is not OOO. If there's an auto-created delegation, deactivate it.
        if (
          existingDelegation &&
          existingDelegation.reason?.includes("Auto-delegated: out-of-office")
        ) {
          await cancelDelegation(conn.org_id, existingDelegation.id);
          delegationsRemoved++;
        }
      }
    } catch (err) {
      captureError({
        error: err instanceof Error ? err : new Error(String(err)),
        service: "calendar-ooo-cron",
        severity: "warning",
        tags: { connectionId: conn.id, userId: conn.user_id },
      });
    }
  }

  return NextResponse.json({
    processed: connections.length,
    delegations_created: delegationsCreated,
    delegations_removed: delegationsRemoved,
  });
}
