import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Onboarding Guide",
  description: "Step-by-step guide to setting up OKrunit, from creating your workspace to connecting your first automation.",
};

export default function OnboardingPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Onboarding Guide", href: "/docs/onboarding" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Onboarding Guide</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Get from sign-up to your first live approval in under 10 minutes.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Step 1: Create Your Workspace</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        After signing up, you&apos;ll go through a quick setup wizard:
      </p>
      <ol className="mt-3 list-decimal pl-6 space-y-2 text-zinc-600">
        <li><strong>Organization name</strong>: Name your workspace (e.g. your company name)</li>
        <li><strong>Invite team members</strong>: Add colleagues by email (optional, can do later)</li>
        <li><strong>Connect messaging</strong>: Link Slack, Discord, or Teams for notifications (optional)</li>
      </ol>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Step 2: Interactive Tutorial</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        After setup, you&apos;ll see a <strong>Getting Started Tutorial</strong> on your dashboard with 5 guided steps:
      </p>
      <ol className="mt-3 list-decimal pl-6 space-y-2 text-zinc-600">
        <li><strong>See a sample approval</strong>: Creates a realistic test request so you can see what one looks like</li>
        <li><strong>Approve or reject it</strong>: Opens the detail panel so you can experience the decision flow</li>
        <li><strong>Set up routing</strong>: Configure who approves requests from each source</li>
        <li><strong>Connect your first tool</strong>: Create an API connection or follow an integration guide</li>
        <li><strong>Set up notifications</strong>: Ensure you&apos;ll get notified when real requests come in</li>
      </ol>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        When you finish all steps and click <strong>Finish &amp; Clean Up</strong>, the test data is automatically deleted
        so your dashboard is fresh for real requests.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Step 3: Connect Your First Integration</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The fastest way to start using OKrunit:
      </p>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">No-code (Zapier, Make, n8n)</p>
          <p className="text-sm text-zinc-600 mt-1">
            Select OKrunit in your automation platform and connect your account via OAuth.
            No API keys or code needed.{" "}
            <Link href="/docs/integrations" className="text-emerald-700 underline">Integration guides →</Link>
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">API (any platform)</p>
          <p className="text-sm text-zinc-600 mt-1">
            Create an API connection in <strong>Connections</strong>, copy your API key,
            and make a POST request to create approval requests.{" "}
            <Link href="/docs/api" className="text-emerald-700 underline">API docs →</Link>
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Step 4: Configure Your Workflow</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Once requests start flowing in, set up:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><Link href="/docs/rules" className="text-emerald-700 underline">Rules & Routing</Link>: Auto-approve low-risk actions, route critical ones to specific teams</li>
        <li><Link href="/docs/escalation" className="text-emerald-700 underline">Escalation</Link>: Automatically remind or escalate when requests go unacted upon</li>
        <li><Link href="/docs/sla" className="text-emerald-700 underline">SLA Targets</Link>: Set response time targets and track compliance</li>
        <li><Link href="/docs/notifications" className="text-emerald-700 underline">Notifications</Link>: Configure which channels get notified and set quiet hours</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">PWA: Install on Mobile</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        OKrunit is a Progressive Web App. On your phone, open the app in your browser and select
        &quot;Add to Home Screen&quot; for an app-like experience with push notifications.
      </p>
    </article>
  );
}
