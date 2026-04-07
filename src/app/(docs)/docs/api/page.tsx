import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Complete API reference for OKrunit: endpoints, authentication, request/response formats, and code examples.",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Endpoint({
  method,
  path,
  description,
  body,
  response,
}: {
  method: string;
  path: string;
  description: string;
  body?: string;
  response: string;
}) {
  const methodColor: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-emerald-100 text-emerald-700",
    PATCH: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
  };

  return (
    <div className="mt-8 rounded-lg border border-zinc-200">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${methodColor[method] ?? "bg-zinc-100 text-zinc-700"}`}
        >
          {method}
        </span>
        <code className="text-sm font-semibold text-zinc-900">{path}</code>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-zinc-700">{description}</p>

        {body && (
          <>
            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Request Body
            </h4>
            <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed">
              <code className="text-zinc-100">{body}</code>
            </pre>
          </>
        )}

        <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Response
        </h4>
        <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed">
          <code className="text-zinc-100">{response}</code>
        </pre>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApiReferencePage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        API Reference
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        The OKrunit REST API lets you create approval requests, check their
        status, and manage decisions programmatically. All endpoints are under
        the{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          /api/v1
        </code>{" "}
        base path.
      </p>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">
          Prefer no-code?
        </h3>
        <p className="mt-1 text-sm text-emerald-800">
          You don&apos;t need to use the API directly. The easiest way to connect
          is to select the OKrunit node inside your automation platform (Zapier,
          Make, n8n, etc.) and connect your account. No code required.{" "}
          <Link href="/docs/integrations" className="underline font-medium">
            See Integrations &rarr;
          </Link>
        </p>
      </div>

      <DocsImage
        src="/screenshots/docs/api-playground.webp"
        alt="OKrunit API Playground for testing API calls interactively"
        caption="Use the API Playground in the dashboard to test API calls interactively before writing code."
      />

      {/* OpenAPI Spec */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900">OpenAPI Specification</h3>
        <p className="mt-1 text-sm text-blue-800">
          Download the machine-readable API spec for code generation, Postman import, or integration tooling:{" "}
          <a href="/openapi.json" target="_blank" rel="noopener noreferrer" className="underline font-medium">
            openapi.json &rarr;
          </a>
        </p>
      </div>

      {/* Base URL */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Base URL</h2>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">https://okrunit.com/api/v1</code>
      </pre>

      {/* Authentication */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Authentication
      </h2>
      <p className="mt-4 text-zinc-700">
        OKrunit supports two authentication methods:
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        API Keys (recommended for server-to-server)
      </h3>
      <p className="mt-2 text-zinc-700">
        Each connection has an API key with the{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          ok_
        </code>{" "}
        prefix followed by 64 hex characters. Pass it as a Bearer token:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`Authorization: Bearer ok_a1b2c3d4e5f6...`}</code>
      </pre>

      <h4 className="mt-4 text-base font-semibold text-zinc-900">
        How to get an API key
      </h4>
      <ol className="mt-2 space-y-2 text-sm text-zinc-700">
        <li className="flex gap-2">
          <span className="font-bold">1.</span>
          <span>
            Go to{" "}
            <Link href="/requests/connections" className="text-emerald-600 hover:underline">
              Connections
            </Link>{" "}
            in the dashboard
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">2.</span>
          <span>Click <strong>New Connection</strong></span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">3.</span>
          <span>Give it a name and save</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">4.</span>
          <span>
            Copy the API key immediately. It&apos;s SHA-256 hashed before
            storage and cannot be retrieved again
          </span>
        </li>
      </ol>

      <DocsImage
        src="/screenshots/docs/connections-list.webp"
        alt="Connections page showing API key management"
        caption="Create and manage API keys from the Connections page."
      />

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        OAuth 2.0 (with PKCE)
      </h3>
      <p className="mt-2 text-zinc-700">
        For user-facing integrations (like Zapier, Make, and other platforms
        that connect on behalf of users), OKrunit supports OAuth 2.0 with PKCE.
        Available scopes:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-700">
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">
            approvals:read
          </code>{" "}
          &mdash; Read approval requests and their status
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">
            approvals:write
          </code>{" "}
          &mdash; Create, approve, reject, and cancel approval requests
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">
            comments:write
          </code>{" "}
          &mdash; Add comments to approval requests
        </li>
      </ul>

      {/* Rate Limits */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Rate Limits
      </h2>
      <p className="mt-4 text-zinc-700">
        API requests are rate-limited per connection. The default limit is{" "}
        <strong>100 requests per hour</strong> per connection, configurable up to
        10,000/hour depending on your plan. Rate limit headers are included in
        every response:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1711296000`}</code>
      </pre>
      <p className="mt-3 text-sm text-zinc-500">
        When the limit is exceeded, the API returns HTTP 429 with a{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">
          Retry-After
        </code>{" "}
        header.
      </p>

      {/* Response Format */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Response Format
      </h2>
      <p className="mt-4 text-zinc-700">
        All successful responses return JSON. Error responses follow a consistent
        structure:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required",
    "details": { ... }
  }
}`}</code>
      </pre>
      <p className="mt-3 text-zinc-700">Common HTTP status codes:</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="pb-2 pr-4 font-semibold text-zinc-900">Code</th>
              <th className="pb-2 font-semibold text-zinc-900">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">200</td>
              <td className="py-2">Success</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">201</td>
              <td className="py-2">Created</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">400</td>
              <td className="py-2">Validation error</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">401</td>
              <td className="py-2">Missing or invalid authentication</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">403</td>
              <td className="py-2">Insufficient permissions</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">404</td>
              <td className="py-2">Resource not found</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">409</td>
              <td className="py-2">
                Conflict (e.g. duplicate idempotency key)
              </td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono">429</td>
              <td className="py-2">Rate limit exceeded</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono">503</td>
              <td className="py-2">Emergency stop is active</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Endpoints */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Endpoints</h2>

      {/* --- Create Approval --- */}
      <h3 className="mt-8 text-xl font-semibold text-zinc-900">
        Approval Requests
      </h3>

      <Endpoint
        method="POST"
        path="/api/v1/approvals"
        description="Create a new approval request. The request is immediately visible to approvers and notifications are sent based on your routing configuration."
        body={`{
  "title": "Delete user account #4821",
  "description": "Permanent deletion requested by user via support ticket",
  "priority": "high",
  "action_type": "user.delete",
  "callback_url": "https://your-app.com/webhooks/okrunit",
  "callback_headers": {
    "X-Custom-Token": "your-secret"
  },
  "metadata": {
    "user_id": "4821",
    "ticket_id": "SUP-1234"
  },
  "expires_at": "2026-03-25T10:00:00.000Z",
  "required_approvals": 2,
  "is_sequential": false,
  "source": "support-bot",
  "idempotency_key": "del-user-4821-20260324"
}`}
        response={`// 201 Created
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "org_id": "org-uuid",
  "connection_id": "conn-uuid",
  "title": "Delete user account #4821",
  "description": "Permanent deletion requested by user via support ticket",
  "status": "pending",
  "priority": "high",
  "action_type": "user.delete",
  "source": "support-bot",
  "required_approvals": 2,
  "current_approvals": 0,
  "is_sequential": false,
  "created_at": "2026-03-24T10:00:00.000Z",
  "expires_at": "2026-03-25T10:00:00.000Z"
}`}
      />

      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h4 className="font-semibold text-zinc-900">Request body fields</h4>
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">title</code>{" "}
            <span className="text-red-600 text-xs font-medium">required</span>: Short
            description of what needs approval
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">description</code>{" "}
            <span className="text-red-600 text-xs font-medium">required</span>: Detailed
            context for the approver
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">priority</code>{" "}
            <span className="text-red-600 text-xs font-medium">required</span>: One of:
            low, medium, high, critical
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">callback_url</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: URL to POST the
            decision to (see{" "}
            <Link href="/docs/webhooks" className="text-emerald-600 hover:underline">
              Webhooks
            </Link>
            )
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">callback_headers</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Custom headers
            included in the webhook callback
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">action_type</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Custom label for
            filtering and routing (e.g. &quot;user.delete&quot;, &quot;deploy.production&quot;)
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">metadata</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Arbitrary JSON
            object passed through to the callback
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">expires_at</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: ISO 8601 timestamp;
            auto-expires if no decision by this time
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">required_approvals</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Number of approvals
            needed (default: 1)
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">is_sequential</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: If true, approvers
            must approve in order (default: false)
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">source</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Name of the
            integration for filtering and analytics
          </div>
          <div>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">idempotency_key</code>{" "}
            <span className="text-zinc-400 text-xs">optional</span>: Prevents duplicate
            requests (see Idempotency below)
          </div>
        </div>
      </div>

      <Endpoint
        method="GET"
        path="/api/v1/approvals"
        description="List approval requests for your organization. Supports pagination, filtering by status and priority, and text search."
        response={`// 200 OK
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "title": "Delete user account #4821",
      "status": "pending",
      "priority": "high",
      "created_at": "2026-03-24T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 42,
    "total_pages": 3
  }
}`}
      />

      <Endpoint
        method="GET"
        path="/api/v1/approvals/:id"
        description="Get full details for a single approval request, including metadata, comments count, and current approval tally."
        response={`// 200 OK
{
  "id": "a1b2c3d4-...",
  "title": "Delete user account #4821",
  "description": "Permanent deletion requested by user via support ticket",
  "status": "pending",
  "priority": "high",
  "action_type": "user.delete",
  "source": "support-bot",
  "metadata": { "user_id": "4821", "ticket_id": "SUP-1234" },
  "required_approvals": 2,
  "current_approvals": 1,
  "is_sequential": false,
  "callback_url": "https://your-app.com/webhooks/okrunit",
  "created_at": "2026-03-24T10:00:00.000Z",
  "expires_at": "2026-03-25T10:00:00.000Z",
  "decided_at": null,
  "decided_by": null
}`}
      />

      <Endpoint
        method="PATCH"
        path="/api/v1/approvals/:id"
        description="Approve or reject a pending approval request. The decision is delivered to the callback URL if one was provided. Requires the request to be in 'pending' status."
        body={`{
  "decision": "approve",
  "comment": "Verified with the user. Proceeding with deletion.",
  "source": "dashboard"
}`}
        response={`// 200 OK
{
  "id": "a1b2c3d4-...",
  "status": "approved",
  "decided_at": "2026-03-24T11:30:00.000Z",
  "decided_by": "user-uuid",
  "callback_delivered": true
}`}
      />

      <Endpoint
        method="DELETE"
        path="/api/v1/approvals/:id"
        description="Cancel a pending approval request. Only requests in 'pending' status can be cancelled. The callback URL receives a cancellation notification."
        response={`// 200 OK
{
  "id": "a1b2c3d4-...",
  "status": "cancelled",
  "cancelled_at": "2026-03-24T11:00:00.000Z"
}`}
      />

      {/* --- Comments --- */}
      <h3 className="mt-12 text-xl font-semibold text-zinc-900">Comments</h3>

      <Endpoint
        method="POST"
        path="/api/v1/approvals/:id/comments"
        description="Add a comment to an approval request. Comments are visible to all org members and are included in the audit trail."
        body={`{
  "body": "Checked the database. This user has no active subscriptions. Safe to proceed."
}`}
        response={`// 201 Created
{
  "id": "comment-uuid",
  "approval_request_id": "a1b2c3d4-...",
  "user_id": "user-uuid",
  "body": "Checked the database. This user has no active subscriptions. Safe to proceed.",
  "created_at": "2026-03-24T10:15:00.000Z"
}`}
      />

      {/* --- Steps --- */}
      <h3 className="mt-12 text-xl font-semibold text-zinc-900">
        Approval Steps (Multi-Step)
      </h3>
      <p className="mt-2 text-zinc-600">
        Multi-step approvals allow you to configure sequential or parallel
        approval chains. Each step can have a different approver. This is useful
        for workflows that require sign-off from multiple people (e.g. manager
        then legal).
      </p>

      <Endpoint
        method="GET"
        path="/api/v1/approvals/:id/steps"
        description="Get all approval steps for a request. Steps are returned in order and include their status and assigned approver."
        response={`// 200 OK
{
  "data": [
    {
      "id": "step-uuid-1",
      "approval_request_id": "a1b2c3d4-...",
      "step_order": 1,
      "approver_id": "user-uuid-1",
      "status": "approved",
      "decided_at": "2026-03-24T10:30:00.000Z"
    },
    {
      "id": "step-uuid-2",
      "approval_request_id": "a1b2c3d4-...",
      "step_order": 2,
      "approver_id": "user-uuid-2",
      "status": "pending",
      "decided_at": null
    }
  ]
}`}
      />

      <Endpoint
        method="POST"
        path="/api/v1/approvals/:id/steps"
        description="Configure approval steps for a request. This replaces any existing step configuration. Each step specifies an approver and their order in the chain."
        body={`{
  "steps": [
    { "approver_id": "user-uuid-1", "step_order": 1 },
    { "approver_id": "user-uuid-2", "step_order": 2 }
  ]
}`}
        response={`// 201 Created
{
  "data": [
    {
      "id": "step-uuid-1",
      "step_order": 1,
      "approver_id": "user-uuid-1",
      "status": "pending"
    },
    {
      "id": "step-uuid-2",
      "step_order": 2,
      "approver_id": "user-uuid-2",
      "status": "pending"
    }
  ]
}`}
      />

      <Endpoint
        method="PATCH"
        path="/api/v1/approvals/:id/steps/:stepId"
        description="Vote on a specific approval step. The step must be in 'pending' status and the authenticated user must be the assigned approver (or have admin privileges)."
        body={`{
  "decision": "approve",
  "comment": "LGTM"
}`}
        response={`// 200 OK
{
  "id": "step-uuid-1",
  "status": "approved",
  "decided_at": "2026-03-24T10:30:00.000Z",
  "decided_by": "user-uuid-1"
}`}
      />

      {/* Query parameters */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Query Parameters
      </h2>
      <p className="mt-4 text-zinc-700">
        The list approvals endpoint (
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          GET /api/v1/approvals
        </code>
        ) supports the following query parameters:
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="pb-2 pr-4 font-semibold text-zinc-900">Param</th>
              <th className="pb-2 pr-4 font-semibold text-zinc-900">Type</th>
              <th className="pb-2 pr-4 font-semibold text-zinc-900">Default</th>
              <th className="pb-2 font-semibold text-zinc-900">Description</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono text-xs">page</td>
              <td className="py-2 pr-4">integer</td>
              <td className="py-2 pr-4">1</td>
              <td className="py-2">Page number</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono text-xs">page_size</td>
              <td className="py-2 pr-4">integer</td>
              <td className="py-2 pr-4">20</td>
              <td className="py-2">Results per page (max 100)</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono text-xs">status</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2 pr-4">&mdash;</td>
              <td className="py-2">
                Filter by status: pending, approved, rejected, cancelled, expired
              </td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-mono text-xs">priority</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2 pr-4">&mdash;</td>
              <td className="py-2">
                Filter by priority: low, medium, high, critical
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">search</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2 pr-4">&mdash;</td>
              <td className="py-2">Full-text search on title and description</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Example: filtering requests
      </h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`# Get all pending high-priority requests
curl "https://okrunit.com/api/v1/approvals?status=pending&priority=high" \\
  -H "Authorization: Bearer ok_your_api_key"

# Search requests by keyword
curl "https://okrunit.com/api/v1/approvals?search=deploy+production" \\
  -H "Authorization: Bearer ok_your_api_key"

# Paginate through results
curl "https://okrunit.com/api/v1/approvals?page=2&page_size=50" \\
  -H "Authorization: Bearer ok_your_api_key"`}</code>
      </pre>

      {/* Idempotency */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Idempotency
      </h2>
      <p className="mt-4 text-zinc-700">
        To prevent duplicate approval requests (e.g. if your automation retries
        on a timeout), include an{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          idempotency_key
        </code>{" "}
        in your create request. If a request with the same key already exists
        within your organization, the API returns the existing request with a
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          {" "}
          200
        </code>{" "}
        status instead of creating a duplicate.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl -X POST https://okrunit.com/api/v1/approvals \\
  -H "Authorization: Bearer ok_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Deploy v2.4.0",
    "description": "Production release",
    "priority": "high",
    "idempotency_key": "deploy-v2.4.0-20260324"
  }'

# If you send the exact same request again with the same key,
# you'll get back the existing request (200) instead of a new one (201)`}</code>
      </pre>

      {/* Code examples */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Code examples
      </h2>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Node.js / TypeScript
      </h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`const response = await fetch("https://okrunit.com/api/v1/approvals", {
  method: "POST",
  headers: {
    Authorization: "Bearer ok_your_api_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Deploy v2.4.0 to production",
    description: "Release includes database migration",
    priority: "high",
    callback_url: "https://your-app.com/webhooks/okrunit",
  }),
});

const approval = await response.json();
console.log(approval.id, approval.status); // "a1b2c3d4-..." "pending"`}</code>
      </pre>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">Python</h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`import requests

response = requests.post(
    "https://okrunit.com/api/v1/approvals",
    headers={"Authorization": "Bearer ok_your_api_key"},
    json={
        "title": "Deploy v2.4.0 to production",
        "description": "Release includes database migration",
        "priority": "high",
        "callback_url": "https://your-app.com/webhooks/okrunit",
    },
)

approval = response.json()
print(approval["id"], approval["status"])  # "a1b2c3d4-..." "pending"`}</code>
      </pre>
    </article>
  );
}
