import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "SLA & Response Targets",
  description: "Set response time targets per priority level and track SLA compliance with breach rates and per-priority breakdowns.",
};

export default function SlaPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "SLA & Response Targets", href: "/docs/sla" },
      ]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">SLA &amp; Response Targets</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Define how quickly your team should respond to approval requests at each priority level,
        and track compliance on the SLA dashboard.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Setting Response Targets</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Navigate to <strong>Organization → Settings → Response Time Targets</strong>. Set a target in minutes for each priority:
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Priority</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Default</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="py-3 px-4 font-medium text-red-600">Critical</td><td className="py-3 px-4">15 min</td><td className="py-3 px-4 text-zinc-600">Must be decided within 15 minutes</td></tr>
            <tr><td className="py-3 px-4 font-medium text-orange-600">High</td><td className="py-3 px-4">60 min</td><td className="py-3 px-4 text-zinc-600">Must be decided within 1 hour</td></tr>
            <tr><td className="py-3 px-4 font-medium text-blue-600">Medium</td><td className="py-3 px-4">Not set</td><td className="py-3 px-4 text-zinc-600">No SLA tracking</td></tr>
            <tr><td className="py-3 px-4 font-medium text-zinc-500">Low</td><td className="py-3 px-4">Not set</td><td className="py-3 px-4 text-zinc-600">No SLA tracking</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Set a priority to &quot;Not set&quot; to disable SLA tracking for that level. Requests without an SLA
        won&apos;t appear in breach counts.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">SLA Compliance Dashboard</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Navigate to <strong>Requests → Insights → SLA Compliance</strong> to view your compliance metrics for the last 30 days.
      </p>
      <p className="mt-3 text-zinc-600 leading-relaxed">The dashboard shows:</p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Compliance %</strong>: Percentage of requests decided before their SLA deadline. Higher is better.</li>
        <li><strong>Tracked</strong>: Total requests that had an SLA deadline set based on their priority.</li>
        <li><strong>Breached</strong>: Requests still pending when their SLA deadline passed.</li>
        <li><strong>Avg Response</strong>: Average time from request creation to decision, across all priorities.</li>
        <li><strong>Per-priority breakdown</strong>: Compliance rate, breach count, and average response time for each priority level with progress bars.</li>
      </ul>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Hover over any metric label to see a tooltip explaining what it means. Click <strong>Edit Targets</strong>
        to jump directly to the settings page where you can adjust your SLA configuration.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">SLA Breach Alerts</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        When requests breach their SLA deadline, two things happen:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li>A <strong>red alert banner</strong> appears on the org overview dashboard showing how many requests have breached</li>
        <li><strong>Notifications</strong> are sent via the configured channels (email, Slack, etc.) with the event type <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">approval.sla_breached</code></li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Demo Mode</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Want to see what the dashboard looks like with data? Add <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">?demo=true</code> to the SLA
        page URL to see realistic mock data with 142 tracked requests across all priorities.
      </p>

      <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">Related</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Configure automatic follow-ups with{" "}
          <Link href="/docs/escalation" className="underline font-medium">Escalation</Link> when
          requests approach their SLA deadlines.
        </p>
      </div>
    </article>
  );
}
