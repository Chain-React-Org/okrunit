// ---------------------------------------------------------------------------
// OKrunit -- Audit Logging
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditEventParams {
  orgId: string;
  userId?: string;
  connectionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  changes?: AuditChange[];
}

/**
 * Insert a row into the `audit_log` table.
 *
 * Uses the Supabase admin (service-role) client so the write always succeeds
 * regardless of RLS policies. Errors are logged but never thrown -- audit
 * logging must never break a request.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("audit_log").insert({
    org_id: params.orgId,
    user_id: params.userId ?? null,
    connection_id: params.connectionId ?? null,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    details: params.details ?? null,
    ip_address: params.ipAddress ?? null,
    changes: params.changes ?? null,
  });

  if (error) {
    console.error("[Audit] Failed to write audit log entry:", error);
  }
}

/**
 * Compute the diff between two objects, returning only the fields that changed.
 * Useful for building the `changes` array when logging updates.
 *
 * Fields present in `newValues` but not in `fields` are ignored.
 * Fields where the old and new values are identical are excluded.
 */
export function computeAuditChanges(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  fields: string[],
): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const field of fields) {
    const oldVal = oldValues[field];
    const newVal = newValues[field];

    // Skip if the field wasn't included in the update
    if (!(field in newValues)) continue;

    // Compare using JSON serialization for deep equality on objects/arrays
    const oldSerialized = JSON.stringify(oldVal ?? null);
    const newSerialized = JSON.stringify(newVal ?? null);

    if (oldSerialized !== newSerialized) {
      changes.push({ field, from: oldVal ?? null, to: newVal ?? null });
    }
  }

  return changes;
}
