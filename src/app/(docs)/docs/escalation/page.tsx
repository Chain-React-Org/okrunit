import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Escalation",
  description: "Configure automatic escalation for approval requests that go unacted upon. Remind approvers, notify managers, or re-route.",
};

export default function EscalationPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "Escalation", href: "/docs/escalation" },
      ]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Escalation</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Escalation rules automatically notify additional people when approval requests sit unacted upon.
        Configure multi-level escalation to ensure nothing falls through the cracks.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">How Escalation Works</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        When a pending approval request hasn&apos;t been acted on within a configured time, OKrunit progressively escalates:
      </p>
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-zinc-600">
        <li><strong>Level 1, Remind</strong>: Re-notify the assigned approvers (e.g. after 30 minutes)</li>
        <li><strong>Level 2, Escalate</strong>: Notify additional people like team leads or all org admins (e.g. after 60 minutes)</li>
        <li><strong>Level 3+, Further escalation</strong>: Notify specific teams or users (configurable)</li>
      </ol>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        Escalation deadlines are calculated from request creation time (not from the previous level), so timing is predictable
        even if the cron job is briefly delayed.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Configuring Escalation</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Navigate to <strong>Organization → Settings</strong> and scroll to the <strong>Escalation Rules</strong> section.
      </p>
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-zinc-600">
        <li>Toggle <strong>Enable escalation</strong> on</li>
        <li>Click <strong>Add escalation level</strong></li>
        <li>Set the <strong>delay</strong> (minutes after request creation)</li>
        <li>Choose the <strong>target</strong>:
          <ul className="mt-1 list-disc pl-6 space-y-1">
            <li><strong>Remind approvers</strong>: Re-send notifications to the currently assigned people</li>
            <li><strong>Notify all admins</strong>: Alert all org owners and admins</li>
            <li><strong>Notify team</strong>: Alert all members of a specific team</li>
            <li><strong>Notify specific users</strong>: Alert specific user IDs</li>
          </ul>
        </li>
        <li>Add more levels as needed (up to 5)</li>
        <li>Click <strong>Save changes</strong></li>
      </ol>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Example Configuration</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Level</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">After</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="py-3 px-4">1</td><td className="py-3 px-4">30 minutes</td><td className="py-3 px-4">Remind same approvers</td></tr>
            <tr><td className="py-3 px-4">2</td><td className="py-3 px-4">60 minutes</td><td className="py-3 px-4">Notify all org admins</td></tr>
            <tr><td className="py-3 px-4">3</td><td className="py-3 px-4">2 hours</td><td className="py-3 px-4">Notify Engineering Leads team</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Escalation Notifications</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Escalation notifications are sent through all configured channels: email, Slack, Discord, Teams, Telegram, web push,
        and in-app notifications. The notification message includes the escalation level and a direct link to the request.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Processing Schedule</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The escalation processor runs <strong>every 5 minutes</strong> via a Vercel Cron job. It checks all organizations
        with escalation enabled for pending requests that have passed their next escalation deadline.
      </p>

      <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">Related</h3>
        <p className="mt-1 text-sm text-emerald-800">
          Set response time targets with{" "}
          <Link href="/docs/sla" className="underline font-medium">SLA & Response Targets</Link>, or
          configure who gets notified with{" "}
          <Link href="/docs/notifications" className="underline font-medium">Notifications & Quiet Hours</Link>.
        </p>
      </div>
    </article>
  );
}
