import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Complete API reference for OKRunit — endpoints, authentication, request/response formats, and code examples.",
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
        The OKRunit REST API lets you create approval requests, check their
        status, and manage decisions programmatically. All endpoints are under
        the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">/api/v1</code> base path.
      </p>

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
        OKRunit supports two authentication methods:
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        API Keys (recommended for server-to-server)
      </h3>
      <p className="mt-2 text-zinc-700">
        Each connection has an API key with the{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">gk_</code> prefix followed
        by 64 hex characters. Pass it as a Bearer token:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`Authorization: Bearer gk_a1b2c3d4e5f6...`}</code>
      </pre>
      <p className="mt-3 text-sm text-zinc-500">
        API keys are SHA-256 hashed before storage. Once generated, the raw key
        cannot be retrieved again.
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        OAuth 2.0 (with PKCE)
      </h3>
      <p className="mt-2 text-zinc-700">
        For user-facing integrations, OKRunit supports OAuth 2.0 with PKCE.
        Available scopes:
      </p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-700">
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">approvals:read</code>{" "}
          &mdash; Read approval requests and their status
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">approvals:write</code>{" "}
          &mdash; Create, approve, reject, and cancel approval requests
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">comments:write</code>{" "}
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
        10,000/hour. Rate limit headers are included in every response:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1711296000`}</code>
      </pre>
      <p className="mt-3 text-sm text-zinc-500">
        When the limit is exceeded, the API returns HTTP 429 with a{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">Retry-After</code> header.
      </p>

      {/* Response Format */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Response Format
      </h2>
      <p className="mt-4 text-zinc-700">
        All successful responses return JSON. Error responses follow a
        consistent structure:
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
              <td className="py-2">Conflict (e.g. duplicate idempotency key)</td>
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
  "body": "Checked the database — this user has no active subscriptions. Safe to proceed."
}`}
        response={`// 201 Created
{
  "id": "comment-uuid",
  "approval_request_id": "a1b2c3d4-...",
  "user_id": "user-uuid",
  "body": "Checked the database — this user has no active subscriptions. Safe to proceed.",
  "created_at": "2026-03-24T10:15:00.000Z"
}`}
      />

      {/* --- Steps --- */}
      <h3 className="mt-12 text-xl font-semibold text-zinc-900">
        Approval Steps
      </h3>
      <p className="mt-2 text-zinc-600">
        Multi-step approvals allow you to configure sequential or parallel
        approval chains. Each step can have a different approver.
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
        The list approvals endpoint (<code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">GET /api/v1/approvals</code>)
        supports the following query parameters:
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

      {/* Idempotency */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Idempotency
      </h2>
      <p className="mt-4 text-zinc-700">
        To prevent duplicate approval requests, include an{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">idempotency_key</code> in
        your create request. If a request with the same key already exists
        within your organization, the API returns the existing request with a
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800"> 200</code> status
        instead of creating a duplicate.
      </p>
    </article>
  );
}
