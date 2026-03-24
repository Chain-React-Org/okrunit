import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Getting Started",
  description:
    "Get started with OKRunit — add human approval to any automation workflow in minutes.",
};

export default function GettingStartedPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Getting Started
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        OKRunit is a human-in-the-loop approval gateway for automated workflows.
        When your AI agent, Zapier zap, or CI/CD pipeline is about to perform a
        destructive or sensitive action, OKRunit pauses execution, notifies the
        right humans, collects their decision, and calls back your automation
        with the result.
      </p>

      {/* How it works */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        How it works
      </h2>
      <ol className="mt-4 space-y-4 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            1
          </span>
          <div>
            <strong className="text-zinc-900">Your automation calls OKRunit.</strong>{" "}
            A single POST request creates an approval request with a title,
            description, priority, and callback URL.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            2
          </span>
          <div>
            <strong className="text-zinc-900">Humans are notified.</strong>{" "}
            OKRunit sends notifications via Slack, email, or push notifications
            to the right approvers based on your routing rules.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            3
          </span>
          <div>
            <strong className="text-zinc-900">Decision is delivered back.</strong>{" "}
            When an approver approves or rejects, OKRunit sends an
            HMAC-signed webhook to your callback URL so your automation can
            continue or abort.
          </div>
        </li>
      </ol>

      {/* Quick start */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Quick start
      </h2>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 1: Create an account
      </h3>
      <p className="mt-2 text-zinc-700">
        <Link href="/signup" className="text-emerald-600 hover:underline">
          Sign up for free
        </Link>{" "}
        to create your organization. You can invite team members later from
        the settings page.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 2: Create a connection
      </h3>
      <p className="mt-2 text-zinc-700">
        Go to{" "}
        <Link
          href="/connections"
          className="text-emerald-600 hover:underline"
        >
          Connections
        </Link>{" "}
        in the dashboard and create a new connection. This generates an API key
        that your automation will use to authenticate requests.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Step 3: Send your first approval request
      </h3>
      <p className="mt-2 text-zinc-700">
        Use the API key from your connection to create an approval request:
      </p>

      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl -X POST https://okrunit.com/api/v1/approvals \\
  -H "Authorization: Bearer gk_your_api_key_here" \\
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

      {/* Polling vs callbacks */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Polling vs. callbacks
      </h2>
      <p className="mt-4 text-zinc-700">
        You have two options for getting the approval result:
      </p>
      <ul className="mt-4 space-y-3 text-zinc-700">
        <li>
          <strong className="text-zinc-900">Callbacks (recommended):</strong>{" "}
          Provide a <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">callback_url</code> when
          creating the request. OKRunit will POST the decision to your URL with
          an HMAC-SHA256 signature for verification.
        </li>
        <li>
          <strong className="text-zinc-900">Polling:</strong>{" "}
          Periodically GET{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">/api/v1/approvals/:id</code>{" "}
          to check the status. Useful for simple scripts or when you cannot
          expose a public endpoint.
        </li>
      </ul>

      {/* Next steps */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Next steps
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/docs/api"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">API Reference</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Full endpoint documentation with request/response examples.
          </p>
        </Link>
        <Link
          href="/docs/integrations"
          className="rounded-lg border border-zinc-200 p-4 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900">Integrations</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Pre-built modules for Zapier, Make, n8n, GitHub Actions, and more.
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
