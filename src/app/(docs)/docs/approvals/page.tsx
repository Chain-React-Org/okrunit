import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Approval Workflow",
  description: "How approval requests work in OKrunit, from creation to decision, with comments, delegation, and archiving.",
};

export default function ApprovalsPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "Approval Workflow", href: "/docs/approvals" },
      ]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Approval Workflow</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Every approval request in OKrunit follows a clear lifecycle: created, reviewed, decided. Here&apos;s how each step works.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">How Requests Are Created</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Approval requests are created when an external automation (Zapier, Make, n8n, or your own API call) sends a POST request
        to the OKrunit API. Each request includes a title, optional description, priority level, and context HTML that helps
        reviewers make their decision.
      </p>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Requests can also include metadata (key-value pairs), an action type (like &quot;deploy&quot; or &quot;delete&quot;),
        and a callback URL where OKrunit will POST the decision once it&apos;s made.
      </p>

      <DocsImage
        src="/screenshots/docs/requests-list.webp"
        alt="Approval requests list showing pending and resolved requests with status badges and filtering"
        caption="All approval requests appear on the Requests page, grouped by status."
      />

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Viewing Requests</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        All requests appear on the <strong>Requests</strong> page, grouped into &quot;Needs Your Attention&quot; (pending)
        and &quot;Previously Resolved&quot; (approved/rejected/expired). Each card shows:
      </p>
      <ul className="mt-4 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Source icon</strong>: Which integration sent the request (Zapier, Make, API, etc.)</li>
        <li><strong>Title</strong>: The main subject of what needs approval</li>
        <li><strong>Priority badge</strong>: Low, Medium, High, or Critical</li>
        <li><strong>Status badge</strong>: Pending, Approved, Rejected, Cancelled, or Expired</li>
        <li><strong>Action type</strong>: What kind of action this is (deploy, delete, purchase, etc.)</li>
        <li><strong>Timestamp</strong>: When the request was created</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Opening the Detail Panel</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Click any request card to open the <strong>detail panel</strong> on the right side of the screen. The detail panel shows:
      </p>
      <ul className="mt-4 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Full context</strong>: Rich HTML context provided by the automation, often including tables, diffs, or summaries</li>
        <li><strong>Metadata grid</strong>: Key-value pairs with all the structured data about the request</li>
        <li><strong>Approval progress</strong>: How many approvals are needed vs. received, and who has voted</li>
        <li><strong>Activity timeline</strong>: Created, escalated, decided events with timestamps</li>
        <li><strong>Comments</strong>: Discussion thread where team members can ask questions or leave notes</li>
        <li><strong>Approve/Reject form</strong>: The decision form with optional comment</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Approving or Rejecting</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        There are several ways to approve or reject a request:
      </p>
      <ul className="mt-4 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>From the detail panel</strong>: Click the Approve or Reject button at the bottom of the panel</li>
        <li><strong>Inline on hover</strong>: On desktop, hover over a pending request card to reveal Approve/Reject buttons directly on the card</li>
        <li><strong>Keyboard shortcuts</strong>: Press <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-mono">a</kbd> to approve or <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-mono">r</kbd> to reject when the detail panel is open</li>
        <li><strong>From email</strong>: Click the one-click approve/reject link in notification emails</li>
        <li><strong>From Slack/Discord</strong>: Use the interactive buttons in Slack or Discord notifications</li>
        <li><strong>Via API</strong>: PATCH the approval request with your decision programmatically</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Adding Comments</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Open the detail panel and scroll to the <strong>Comments</strong> section at the bottom. Type your message and press Enter
        or click Send. Comments are visible to all org members and update in real-time for anyone viewing the same request.
      </p>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Use comments to ask for clarification, flag concerns, or provide context for your decision.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Archiving Requests</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Resolved requests can be archived to keep your queue clean. Use the <strong>three-dot menu</strong> on any request card
        and select &quot;Archive&quot;. Archived requests are hidden from the default view but can be shown by toggling the
        &quot;Show Archived&quot; filter.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Exporting Data</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Click the <strong>Export</strong> button above the request list to download all visible approvals as a CSV file.
        The export includes ID, title, status, priority, action type, source, and timestamps.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Request Lifecycle</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="py-3 px-4 font-medium">Pending</td><td className="py-3 px-4 text-zinc-600">Waiting for human review</td></tr>
            <tr><td className="py-3 px-4 font-medium">Approved</td><td className="py-3 px-4 text-zinc-600">Approved by required number of reviewers, callback fires</td></tr>
            <tr><td className="py-3 px-4 font-medium">Rejected</td><td className="py-3 px-4 text-zinc-600">Rejected by a reviewer, callback fires with rejection</td></tr>
            <tr><td className="py-3 px-4 font-medium">Cancelled</td><td className="py-3 px-4 text-zinc-600">Cancelled by the requester or an admin</td></tr>
            <tr><td className="py-3 px-4 font-medium">Expired</td><td className="py-3 px-4 text-zinc-600">No decision before the expiration deadline</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">Next Steps</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Learn how to set up automatic routing with{" "}
          <Link href="/docs/rules" className="underline font-medium">Rules & Routing</Link>, or
          configure escalation for stale requests with{" "}
          <Link href="/docs/escalation" className="underline font-medium">Escalation</Link>.
        </p>
      </div>
    </article>
  );
}
