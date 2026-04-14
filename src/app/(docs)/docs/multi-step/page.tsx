import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Multi-Step Approvals",
  description: "Configure sequential approval chains where multiple people must approve in order: manager first, then VP, then compliance.",
};

export default function MultiStepPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Multi-Step Approvals", href: "/docs/multi-step" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Multi-Step Approvals</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Require multiple approvers in sequence or parallel. Configure approval chains where each step must be completed before the next begins.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">How It Works</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        A multi-step approval has an ordered list of steps. Each step specifies who needs to approve and how many approvals are needed.
        Steps can be <strong>sequential</strong> (one after another) or <strong>parallel</strong> (all at once).
      </p>

      <h3 className="mt-8 text-xl font-semibold text-zinc-900">Sequential Mode</h3>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Each step must be completed before the next step activates. Only the current step&apos;s approvers are notified.
      </p>
      <div className="mt-4 flex items-center gap-3 text-sm text-zinc-600">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 font-medium">Step 1: Manager</div>
        <span className="text-zinc-400">→</span>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 font-medium">Step 2: VP</div>
        <span className="text-zinc-400">→</span>
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700 font-medium">Step 3: Compliance</div>
      </div>

      <h3 className="mt-8 text-xl font-semibold text-zinc-900">Required Approvals</h3>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Set <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">required_approvals</code> to require more than one person to approve.
        For example, require 2 out of 5 team members to approve before moving to the next step.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Configuring via Routes</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The easiest way to set up multi-step approvals is through the <strong>Routes</strong> page:
      </p>
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-zinc-600">
        <li>Go to <strong>Requests → Routes</strong></li>
        <li>Click the <strong>gear icon</strong> on any flow card</li>
        <li>Toggle <strong>Sequential chain</strong> on</li>
        <li>Set the <strong>required approvals</strong> count</li>
        <li>Assign approvers or a team</li>
      </ol>

      <DocsImage
        src="/screenshots/docs/routes-list.webp"
        alt="Routes page showing approval flow cards with sequential chain and required approvals settings"
        caption="Configure multi-step approval chains from the Routes page."
      />

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Configuring via API</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Create approval steps programmatically:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`POST /api/v1/approvals/:id/steps
{
  "steps": [
    {
      "name": "Manager Review",
      "assigned_user_ids": ["user-uuid-1"],
      "required_approvals": 1
    },
    {
      "name": "VP Approval",
      "assigned_team_id": "team-uuid",
      "required_approvals": 1
    }
  ]
}`}</code>
      </pre>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Viewing Step Progress</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Open any multi-step request&apos;s detail panel to see the <strong>Approval Progress</strong> section.
        Each step shows its status (Waiting, Active, Approved, Rejected) and who has voted.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Four-Eyes Principle</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The four-eyes principle automatically requires 2+ approvers for high-risk actions. Configure it in{" "}
        <strong>Organization → Settings → Four-Eyes Rule</strong>. You can scope it to specific action types
        and minimum priority levels.
      </p>

      <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">Related</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Use <Link href="/docs/rules" className="underline font-medium">Rules & Routing</Link> to automatically
          require multiple approvers based on conditions, or{" "}
          <Link href="/docs/escalation" className="underline font-medium">Escalation</Link> to auto-notify
          when steps take too long.
        </p>
      </div>
    </article>
  );
}
