// ---------------------------------------------------------------------------
// OKrunit -- Approval Export Helpers
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { titleCaseName } from "@/lib/format-name";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  priority?: string;
}

export interface ExportApproval {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  action_type: string | null;
  source: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
  decision_comment: string | null;
  decision_source: string | null;
  required_approvals: number;
  current_approvals: number;
  risk_score: number | null;
  risk_level: string | null;
  sla_breached: boolean;
}

// ---------------------------------------------------------------------------
// CSV Field Definitions
// ---------------------------------------------------------------------------

const CSV_HEADERS: Array<{ key: keyof ExportApproval; label: string }> = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "action_type", label: "Action Type" },
  { key: "source", label: "Source" },
  { key: "created_at", label: "Created At" },
  { key: "decided_at", label: "Decided At" },
  { key: "decided_by_name", label: "Decided By" },
  { key: "decision_comment", label: "Decision Comment" },
  { key: "decision_source", label: "Decision Source" },
  { key: "required_approvals", label: "Required Approvals" },
  { key: "current_approvals", label: "Current Approvals" },
  { key: "risk_score", label: "Risk Score" },
  { key: "risk_level", label: "Risk Level" },
  { key: "sla_breached", label: "SLA Breached" },
];

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

/**
 * Query approvals for export with all relevant fields and user names.
 *
 * Uses the admin client to bypass RLS -- the caller must have already
 * validated that the user has permission to access this org's data.
 */
export async function fetchExportData(
  orgId: string,
  filters: ExportFilters,
): Promise<ExportApproval[]> {
  const admin = createAdminClient();

  // Build query
  let query = admin
    .from("approval_requests")
    .select(
      "id, title, description, status, priority, action_type, source, " +
      "created_at, decided_at, decided_by, decision_comment, decision_source, " +
      "required_approvals, current_approvals, risk_score, risk_level, sla_breached",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters.endDate) {
    // End date should be inclusive of the full day
    const endDateInclusive = `${filters.endDate}T23:59:59.999Z`;
    query = query.lte("created_at", endDateInclusive);
  }

  // Limit to 10,000 rows to prevent excessive exports
  query = query.limit(10_000);

  const { data: rawApprovals, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch export data: ${error.message}`);
  }

  if (!rawApprovals || rawApprovals.length === 0) {
    return [];
  }

  // Cast to a usable type -- Supabase returns a generic type from .select()
  const approvals = rawApprovals as unknown as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    action_type: string | null;
    source: string | null;
    created_at: string;
    decided_at: string | null;
    decided_by: string | null;
    decision_comment: string | null;
    decision_source: string | null;
    required_approvals: number;
    current_approvals: number;
    risk_score: number | null;
    risk_level: string | null;
    sla_breached: boolean;
  }>;

  // Resolve decided_by user names
  const decidedByIds = [
    ...new Set(
      approvals
        .map((a) => a.decided_by)
        .filter((id): id is string => !!id),
    ),
  ];

  let nameMap = new Map<string, string>();
  if (decidedByIds.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", decidedByIds);

    nameMap = new Map(
      (profiles ?? []).map(
        (p: { id: string; full_name: string | null; email: string }) => [
          p.id,
          titleCaseName(p.full_name) || p.email,
        ],
      ),
    );
  }

  // Map to export format
  return approvals.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    priority: a.priority,
    action_type: a.action_type,
    source: a.source,
    created_at: a.created_at,
    decided_at: a.decided_at,
    decided_by_name: a.decided_by
      ? nameMap.get(a.decided_by) ?? null
      : null,
    decision_comment: a.decision_comment,
    decision_source: a.decision_source,
    required_approvals: a.required_approvals,
    current_approvals: a.current_approvals,
    risk_score: a.risk_score,
    risk_level: a.risk_level,
    sla_breached: a.sla_breached,
  }));
}

// ---------------------------------------------------------------------------
// CSV Generation (RFC 4180 compliant)
// ---------------------------------------------------------------------------

/**
 * Escape a single CSV field value per RFC 4180.
 *
 * - If the value contains a comma, double-quote, or newline, wrap it in
 *   double-quotes and escape any embedded double-quotes by doubling them.
 * - Null/undefined values become empty strings.
 */
function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Check if quoting is needed
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert an array of approvals to an RFC 4180-compliant CSV string.
 */
export function generateCSV(approvals: ExportApproval[]): string {
  // Header row
  const headerRow = CSV_HEADERS.map((h) => escapeCSVField(h.label)).join(",");

  // Data rows
  const dataRows = approvals.map((approval) =>
    CSV_HEADERS.map((h) => escapeCSVField(approval[h.key])).join(","),
  );

  return [headerRow, ...dataRows].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// JSON Generation
// ---------------------------------------------------------------------------

/**
 * Generate a clean JSON export (no internal fields).
 */
export function generateJSON(approvals: ExportApproval[]): string {
  return JSON.stringify(approvals, null, 2);
}
