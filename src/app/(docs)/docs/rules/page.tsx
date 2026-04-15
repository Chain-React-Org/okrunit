import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Rules & Routing",
  description: "Configure conditional routing rules to auto-approve, route to specific teams, or require multiple approvers based on request conditions.",
};

export default function RulesPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "Rules & Routing", href: "/docs/rules" },
      ]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Rules & Routing</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Rules let you automatically handle incoming approval requests based on conditions. Auto-approve low-risk actions,
        route critical requests to specific teams, or require multiple approvers for sensitive operations.
      </p>

      <DocsImage
        src="/screenshots/docs/rules-list.webp"
        alt="Rules page showing configured routing rules with conditions and actions"
        caption="Manage all your routing rules from the Rules page."
      />

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">How Rules Work</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Rules are evaluated in <strong>priority order</strong> (lowest number first) when a new approval request comes in.
        The first rule that matches wins. Its action is applied and no further rules are checked.
      </p>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Each rule has <strong>conditions</strong> (what to match) and an <strong>action</strong> (what to do).
        All conditions within a rule use AND logic, so every condition must match for the rule to fire.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Creating a Rule</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Navigate to <strong>Requests → Rules</strong> in the sidebar and click <strong>New Rule</strong>.
      </p>

      <h3 className="mt-8 text-xl font-semibold text-zinc-900">Conditions</h3>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Select one or more conditions that must all be true for the rule to match:
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Condition</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Description</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-3 px-4 font-medium">Priority Levels</td>
              <td className="py-3 px-4 text-zinc-600">Match requests with specific priorities</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">high, critical</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Action Types</td>
              <td className="py-3 px-4 text-zinc-600">Match by action type with wildcard support</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">deploy*, delete</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Sources</td>
              <td className="py-3 px-4 text-zinc-600">Match by which platform sent the request</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">zapier, make, api</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Risk Levels</td>
              <td className="py-3 px-4 text-zinc-600">Match by calculated risk level</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">high, critical</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Title Pattern</td>
              <td className="py-3 px-4 text-zinc-600">Regex pattern matched against request title</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">production|staging</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Connection</td>
              <td className="py-3 px-4 text-zinc-600">Scope rule to a specific API connection</td>
              <td className="py-3 px-4 text-zinc-500 font-mono text-xs">(select from dropdown)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-xl font-semibold text-zinc-900">Actions</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Action</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-3 px-4 font-medium">Auto-approve</td>
              <td className="py-3 px-4 text-zinc-600">Automatically approves matching requests with no human review</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Route to team</td>
              <td className="py-3 px-4 text-zinc-600">Assigns matching requests to a specific team for review</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Route to users</td>
              <td className="py-3 px-4 text-zinc-600">Assigns matching requests to specific user IDs</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Required approvals</td>
              <td className="py-3 px-4 text-zinc-600">Override the number of approvals needed (e.g. require 3 instead of 1)</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Sequential chain</td>
              <td className="py-3 px-4 text-zinc-600">Enable ordered approval chain (first approver, then second, etc.)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Example Rules</h2>

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Auto-approve low-risk Zapier requests</p>
          <p className="mt-1 text-sm text-zinc-600">
            <strong>If:</strong> priority = low AND source = zapier<br />
            <strong>Then:</strong> Auto-approve
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Critical deploys need 3 approvers from Security</p>
          <p className="mt-1 text-sm text-zinc-600">
            <strong>If:</strong> priority = critical AND action type = deploy*<br />
            <strong>Then:</strong> Route to Security team, require 3 approvals
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Production deletions need sequential approval</p>
          <p className="mt-1 text-sm text-zinc-600">
            <strong>If:</strong> action type = delete AND title matches /production/<br />
            <strong>Then:</strong> Route to Ops team, sequential chain, require 2 approvals
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Pattern Suggestions</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        OKrunit analyzes your approval history and suggests rules based on patterns. If you&apos;ve approved the same
        type of request 10+ times with a 90%+ approval rate, you&apos;ll see a suggestion on the{" "}
        <Link href="/docs/approvals" className="text-emerald-700 underline">Analytics page</Link>{" "}
        to create an auto-approve rule with one click.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Managing Rules</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        On the Rules page, you can:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li>Enable/disable rules without deleting them</li>
        <li>Edit conditions and actions</li>
        <li>Reorder priority (lower number = higher priority)</li>
        <li>Delete rules</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">API</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Rules can also be managed via the API:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`GET    /api/v1/rules          # List all rules
POST   /api/v1/rules          # Create a rule
PATCH  /api/v1/rules/:id      # Update a rule
DELETE /api/v1/rules/:id      # Delete a rule`}</code>
      </pre>
    </article>
  );
}
