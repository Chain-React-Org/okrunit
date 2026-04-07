import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Bulk Operations",
  description: "Approve, reject, or archive multiple approval requests at once. Export data as CSV.",
};

export default function BulkOperationsPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Bulk Operations", href: "/docs/bulk-operations" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Bulk Operations</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Select multiple requests and approve, reject, or archive them all at once.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Selecting Requests</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        On the <strong>Requests</strong> page, check the checkbox on any request card to select it. Use the
        &quot;Select all&quot; checkbox at the top to select all visible requests. The selection count appears
        next to the checkbox.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Batch Actions</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        When one or more requests are selected, a <strong>batch action bar</strong> appears with these options:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Approve All</strong>: Approve all selected pending requests</li>
        <li><strong>Reject All</strong>: Reject all selected pending requests</li>
        <li><strong>Archive</strong>: Archive all selected resolved requests</li>
      </ul>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Batch operations process up to <strong>50 requests</strong> at a time. Each request is processed independently.
        If one fails, the others still complete.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">CSV Export</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Click the <strong>Export</strong> button above the request list to download all visible approvals as CSV.
        The export includes:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li>Request ID</li>
        <li>Title</li>
        <li>Status (pending, approved, rejected, etc.)</li>
        <li>Priority</li>
        <li>Action type</li>
        <li>Source</li>
        <li>Created timestamp</li>
        <li>Decided timestamp</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Archiving</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Archived requests are hidden from the default list view. To see them, toggle <strong>Show Archived</strong>
        in the filter bar. Archived requests can be unarchived from the three-dot menu on each card.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">API</h2>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`# Batch approve/reject
POST /api/v1/approvals/batch
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "decision": "approve",
  "comment": "Batch approved"
}

# Batch archive/unarchive
POST /api/v1/approvals/batch/archive
{
  "ids": ["uuid-1", "uuid-2"],
  "action": "archive"
}`}</code>
      </pre>
    </article>
  );
}
