import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Getting Started",
  description:
    "Get started with OKrunit — add human approval to any automation workflow in minutes.",
};

export default function GettingStartedPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "Getting Started", href: "/docs" },
      ]} />
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Getting Started
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        OKrunit is a human-in-the-loop approval gateway for automated workflows.
        When your AI agent, Zapier zap, Make scenario, or CI/CD pipeline is about
        to perform a destructive or sensitive action, OKrunit pauses execution,
        notifies the right humans, collects their decision, and delivers the
        result back to your automation.
      </p>

      <DocsImage
        src="/screenshots/docs/dashboard-overview.webp"
        alt="OKrunit dashboard overview showing pending requests, approval rate, and recent activity"
        caption="The OKrunit dashboard gives you a real-time view of all approval activity across your organization."
      />

      {/* How it works */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        How it works
      </h2>
      <p className="mt-2 text-zinc-600">
        OKrunit sits between your automation and the action it wants to perform.
        Here&apos;s the flow:
      </p>
      <ol className="mt-4 space-y-4 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            1
          </span>
          <div>
            <strong className="text-zinc-900">Your automation sends a request.</strong>{" "}
            This can happen two ways: through a native integration (select the
            OKrunit node inside Zapier, Make, n8n, etc.) or by calling our REST
            API directly with a single POST request.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            2
          </span>
          <div>
            <strong className="text-zinc-900">The right people are notified.</strong>{" "}
            OKrunit sends notifications via Slack, Discord, Microsoft Teams,
            email, or Telegram based on your routing rules. Approvers can review
            and decide from any of these channels or the dashboard.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            3
          </span>
          <div>
            <strong className="text-zinc-900">The decision flows back automatically.</strong>{" "}
            When an approver approves or rejects, OKrunit delivers the result
            back to your automation via an HMAC-signed webhook callback, so your
            workflow can continue or abort.
          </div>
        </li>
      </ol>

      <DocsImage
        src="/screenshots/docs/requests-list.webp"
        alt="Approval requests list showing pending, approved, and rejected requests with filtering options"
        caption="All approval requests are visible in the Requests page with filtering by status, priority, and source."
      />

      {/* Two ways to connect */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Two ways to connect
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold text-emerald-900">
            No-code: Use a platform integration
          </h3>
          <p className="mt-2 text-sm text-emerald-800">
            The easiest way to get started. Inside Zapier, Make.com, n8n,
            monday.com, or any supported platform, search for the{" "}
            <strong>OKrunit</strong> node/module. Select it, connect your OKrunit
            account, and you&apos;re done — no code needed.
          </p>
          <p className="mt-3 text-sm text-emerald-800">
            <Link href="/docs/integrations" className="underline font-medium">
              See all 19 integrations &rarr;
            </Link>
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
          <h3 className="font-semibold text-zinc-900">
            Code: Use the REST API
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            For developers and technical users, call our API directly from any
            language. Create approval requests, poll for decisions, or receive
            webhook callbacks — all with standard HTTP.
          </p>
          <p className="mt-3 text-sm text-zinc-600">
            <Link href="/docs/api" className="underline font-medium text-zinc-900">
              See the API reference &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Quick start — No-code */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Quick start (no-code)
      </h2>
      <p className="mt-2 text-zinc-600">
        This is the fastest way to add human approval to an existing workflow.
        We&apos;ll use Zapier as the example, but the flow is identical in Make, n8n,
        and other supported platforms.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 1: Create your OKrunit account
      </h3>
      <p className="mt-2 text-zinc-700">
        <Link href="/signup" className="text-emerald-600 hover:underline">
          Sign up for free
        </Link>{" "}
        — it takes 30 seconds. You&apos;ll get an organization and a free plan
        with 50 approval requests per month.
      </p>
      <DocsImage
        src="/screenshots/docs/signup.webp"
        alt="OKrunit signup page"
        caption="Create your free account to get started."
      />

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 2: Open your automation platform and add the OKrunit node
      </h3>
      <p className="mt-2 text-zinc-700">
        In your automation platform (Zapier, Make, n8n, etc.), add a new step to
        your workflow and search for <strong>&quot;OKrunit&quot;</strong>. Select
        the OKrunit action — typically called{" "}
        <strong>&quot;Create Approval Request&quot;</strong>.
      </p>
      <p className="mt-2 text-zinc-700">
        When prompted, connect your OKrunit account. The platform will guide you
        through the OAuth flow — just sign in to OKrunit and authorize access.
        That&apos;s it.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 3: Configure the approval request
      </h3>
      <p className="mt-2 text-zinc-700">
        Fill in the fields the platform shows you:
      </p>
      <ul className="mt-2 space-y-2 text-zinc-700">
        <li className="flex gap-2">
          <span className="text-emerald-600 font-bold">&#8226;</span>
          <span><strong>Title</strong> — a short description of what needs approval (e.g. &quot;Deploy v2.4.0 to production&quot;)</span>
        </li>
        <li className="flex gap-2">
          <span className="text-emerald-600 font-bold">&#8226;</span>
          <span><strong>Description</strong> — additional context for the approver</span>
        </li>
        <li className="flex gap-2">
          <span className="text-emerald-600 font-bold">&#8226;</span>
          <span><strong>Priority</strong> — low, medium, high, or critical</span>
        </li>
      </ul>
      <p className="mt-3 text-zinc-700">
        Your workflow will now pause at the OKrunit step until a human approves or
        rejects. The decision is automatically passed to the next step in your
        workflow.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 4: Set up notifications
      </h3>
      <p className="mt-2 text-zinc-700">
        In the OKrunit dashboard, go to{" "}
        <Link href="/messaging" className="text-emerald-600 hover:underline">
          Messaging
        </Link>{" "}
        to connect your notification channels (Slack, Discord, Teams, email, or
        Telegram). Then go to{" "}
        <Link href="/routes" className="text-emerald-600 hover:underline">
          Routes
        </Link>{" "}
        to configure who gets notified for which types of requests.
      </p>
      <DocsImage
        src="/screenshots/docs/messaging-channels.webp"
        alt="Messaging channels configuration showing Slack, Discord, Teams, Email, and Telegram options"
        caption="Connect your notification channels so approvers are instantly notified."
      />

      {/* Quick start — API */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Quick start (API)
      </h2>
      <p className="mt-2 text-zinc-600">
        For developers who prefer to work in code, you can integrate OKrunit with
        a single HTTP request from any language.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 1: Create a connection
      </h3>
      <p className="mt-2 text-zinc-700">
        Go to{" "}
        <Link href="/connections" className="text-emerald-600 hover:underline">
          Connections
        </Link>{" "}
        in the dashboard and click <strong>New Connection</strong>. Give it a name
        (e.g. &quot;Production API&quot;) and save. Copy the generated API key —
        it starts with{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          ok_
        </code>{" "}
        and cannot be retrieved again.
      </p>
      <DocsImage
        src="/screenshots/docs/connections-list.webp"
        alt="Connections page showing API keys and connection management"
        caption="Create connections to generate API keys for your automations."
      />

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 2: Send your first approval request
      </h3>
      <p className="mt-2 text-zinc-700">
        Use your API key to create an approval request:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl -X POST https://okrunit.com/api/v1/approvals \\
  -H "Authorization: Bearer ok_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Deploy v2.4.0 to production",
    "description": "Release includes database migration and new auth flow",
    "priority": "high",
    "callback_url": "https://your-app.com/webhooks/okrunit",
    "metadata": {
      "environment": "production",
      "commit_sha": "abc123"
    }
  }'`}</code>
      </pre>

      <p className="mt-4 text-zinc-700">
        The response includes the approval request ID and its current status:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Deploy v2.4.0 to production",
  "status": "pending",
  "priority": "high",
  "created_at": "2026-03-24T10:00:00.000Z",
  "expires_at": null
}`}</code>
      </pre>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 3: Receive the decision
      </h3>
      <p className="mt-2 text-zinc-700">
        You have two options for getting the approval result:
      </p>
      <ul className="mt-4 space-y-3 text-zinc-700">
        <li>
          <strong className="text-zinc-900">Callbacks (recommended):</strong>{" "}
          Provide a{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
            callback_url
          </code>{" "}
          when creating the request. OKrunit will POST the decision to your URL
          with an HMAC-SHA256 signature for verification. See the{" "}
          <Link
            href="/docs/webhooks"
            className="text-emerald-600 hover:underline"
          >
            Webhooks guide
          </Link>
          .
        </li>
        <li>
          <strong className="text-zinc-900">Polling:</strong> Periodically GET{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
            /api/v1/approvals/:id
          </code>{" "}
          to check the status. Useful for simple scripts or when you cannot
          expose a public endpoint.
        </li>
      </ul>

      {/* Dashboard overview */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Navigating the dashboard
      </h2>
      <p className="mt-2 text-zinc-600">
        Once you&apos;re set up, here&apos;s what each section of the dashboard does:
      </p>

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Requests</h3>
          <p className="mt-1 text-sm text-zinc-600">
            View, filter, approve, and reject all approval requests. Filter by
            status (pending, approved, rejected), priority, and source. Click any
            request to see full details and respond.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Connections</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Manage your API keys. Each connection represents an automation source
            (your CI/CD, Zapier, Make, etc.) with its own API key and rate limits.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Routes</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Configure approval flows — set required approvals, choose sequential
            vs. parallel mode, assign approvers, and set expiration rules.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Messaging</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Connect notification channels (Slack, Discord, Teams, email, Telegram)
            so approvers are instantly notified when a new request comes in.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Analytics</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Track approval volume, approval rate, and response time over the last
            30 days with interactive charts.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <h3 className="font-semibold text-zinc-900">Audit Log</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Full history of every action — approvals, rejections, config changes,
            and more — with timestamps and actor attribution.
          </p>
        </div>
      </div>

      <DocsImage
        src="/screenshots/docs/analytics-dashboard.webp"
        alt="Analytics dashboard showing approval volume, approval rate, and response time charts"
        caption="The analytics dashboard tracks trends across your approval workflows."
      />

      {/* Next steps */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Next steps
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/docs/integrations"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">Integrations</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Connect OKrunit to Zapier, Make, n8n, GitHub Actions, and 15 more
            platforms with zero code.
          </p>
        </Link>
        <Link
          href="/docs/api"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">API Reference</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Full endpoint documentation with request/response examples for
            developers.
          </p>
        </Link>
        <Link
          href="/docs/webhooks"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">Webhooks</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Learn how callbacks work, verify signatures, and handle retries.
          </p>
        </Link>
        <Link
          href="/docs/billing"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">Plans & Billing</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Compare plans, usage limits, and enterprise features.
          </p>
        </Link>
      </div>
    </article>
  );
}
