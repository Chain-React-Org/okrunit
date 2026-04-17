// ---------------------------------------------------------------------------
// OKrunit -- OpenAPI 3.1 Specification Generator
// ---------------------------------------------------------------------------
// Uses @asteasolutions/zod-to-openapi to convert Zod schemas into an OpenAPI
// spec. The spec is served at GET /api/v1/openapi.
// ---------------------------------------------------------------------------

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with the .openapi() method
extendZodWithOpenApi(z);

import {
  createApprovalSchema,
  respondApprovalSchema,
  paginationSchema,
  createConnectionSchema,
  updateConnectionSchema,
  createTeamSchema,
  updateTeamSchema,
  createRuleSchema,
  webhookLogQuerySchema,
  batchApprovalSchema,
  createCommentSchema,
} from "@/lib/api/validation";

const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security schemes
// ---------------------------------------------------------------------------

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  description:
    "API key authentication. Use the API key from a connection as the bearer token.",
});

registry.registerComponent("securitySchemes", "CookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "sb-access-token",
  description: "Session cookie authentication for dashboard users.",
});

// ---------------------------------------------------------------------------
// Reusable response schemas
// ---------------------------------------------------------------------------

const ErrorResponse = registry.register(
  "ErrorResponse",
  z.object({
    error: z.string().openapi({ description: "Human-readable error message" }),
    code: z.string().optional().openapi({ description: "Machine-readable error code" }),
    issues: z.array(z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    })).optional().openapi({ description: "Validation error details (Zod format)" }),
  }).openapi("ErrorResponse"),
);

const PaginatedMeta = z.object({
  total: z.number().openapi({ description: "Total number of matching records" }),
  page: z.number().openapi({ description: "Current page number (1-based)" }),
  page_size: z.number().openapi({ description: "Number of records per page" }),
});

// ---------------------------------------------------------------------------
// Shared schema for approval request objects returned by the API
// ---------------------------------------------------------------------------

const ApprovalResponse = registry.register(
  "ApprovalResponse",
  z.object({
    id: z.string().openapi({ description: "Unique approval request ID (UUID)" }),
    org_id: z.string().openapi({ description: "Organization ID" }),
    connection_id: z.string().nullable().openapi({ description: "Connection that created this request" }),
    title: z.string().openapi({ description: "Approval request title" }),
    description: z.string().nullable().openapi({ description: "Detailed description" }),
    action_type: z.string().nullable().openapi({ description: "Action type for categorization" }),
    priority: z.enum(["low", "medium", "high", "critical"]).openapi({ description: "Priority level" }),
    status: z.enum(["pending", "approved", "rejected", "cancelled", "expired"]).openapi({ description: "Current status" }),
    callback_url: z.string().nullable().openapi({ description: "URL to call back when decided" }),
    metadata: z.record(z.string(), z.unknown()).nullable().openapi({ description: "Arbitrary metadata" }),
    expires_at: z.string().nullable().openapi({ description: "ISO 8601 expiration time" }),
    decided_by: z.string().nullable().openapi({ description: "User ID of the decider" }),
    decided_at: z.string().nullable().openapi({ description: "ISO 8601 decision time" }),
    decision_comment: z.string().nullable().openapi({ description: "Comment left with the decision" }),
    created_at: z.string().openapi({ description: "ISO 8601 creation time" }),
    updated_at: z.string().openapi({ description: "ISO 8601 last update time" }),
    required_approvals: z.number().openapi({ description: "Number of approvals required" }),
    current_approvals: z.number().openapi({ description: "Number of approvals received so far" }),
    auto_approved: z.boolean().openapi({ description: "Whether auto-approved by a rule" }),
    risk_score: z.number().nullable().openapi({ description: "Computed risk score (0-100)" }),
    risk_level: z.string().nullable().openapi({ description: "Risk level: low, medium, high, critical" }),
  }).openapi("ApprovalResponse"),
);

const ConnectionResponse = registry.register(
  "ConnectionResponse",
  z.object({
    id: z.string().openapi({ description: "Connection ID (UUID)" }),
    org_id: z.string().openapi({ description: "Organization ID" }),
    name: z.string().openapi({ description: "Connection display name" }),
    description: z.string().nullable().openapi({ description: "Optional description" }),
    api_key_prefix: z.string().openapi({ description: "First characters of the API key for identification" }),
    is_active: z.boolean().openapi({ description: "Whether the connection is active" }),
    rate_limit_per_hour: z.number().openapi({ description: "Max requests per hour" }),
    allowed_action_types: z.array(z.string()).nullable().openapi({ description: "Allowed action types (null = all)" }),
    max_priority: z.string().nullable().openapi({ description: "Max priority level allowed" }),
    last_used_at: z.string().nullable().openapi({ description: "ISO 8601 last usage time" }),
    created_at: z.string().openapi({ description: "ISO 8601 creation time" }),
    updated_at: z.string().openapi({ description: "ISO 8601 last update time" }),
  }).openapi("ConnectionResponse"),
);

const TeamResponse = registry.register(
  "TeamResponse",
  z.object({
    id: z.string().openapi({ description: "Team ID (UUID)" }),
    org_id: z.string().openapi({ description: "Organization ID" }),
    name: z.string().openapi({ description: "Team name" }),
    description: z.string().nullable().openapi({ description: "Team description" }),
    created_at: z.string().openapi({ description: "ISO 8601 creation time" }),
    updated_at: z.string().openapi({ description: "ISO 8601 last update time" }),
  }).openapi("TeamResponse"),
);

const RuleResponse = registry.register(
  "RuleResponse",
  z.object({
    id: z.string().openapi({ description: "Rule ID (UUID)" }),
    org_id: z.string().openapi({ description: "Organization ID" }),
    name: z.string().openapi({ description: "Rule name" }),
    description: z.string().nullable().openapi({ description: "Rule description" }),
    is_active: z.boolean().openapi({ description: "Whether the rule is active" }),
    priority_order: z.number().openapi({ description: "Evaluation order (lower = higher priority)" }),
    conditions: z.record(z.string(), z.unknown()).openapi({ description: "Matching conditions" }),
    action: z.enum(["auto_approve", "route"]).openapi({ description: "Action to take when matched" }),
    action_config: z.record(z.string(), z.unknown()).nullable().openapi({ description: "Action configuration (e.g. team_id for routing)" }),
    created_at: z.string().openapi({ description: "ISO 8601 creation time" }),
    updated_at: z.string().openapi({ description: "ISO 8601 last update time" }),
  }).openapi("RuleResponse"),
);

const WebhookLogEntry = registry.register(
  "WebhookLogEntry",
  z.object({
    id: z.string().openapi({ description: "Log entry ID" }),
    request_id: z.string().openapi({ description: "Approval request ID" }),
    connection_id: z.string().nullable().openapi({ description: "Connection ID" }),
    url: z.string().openapi({ description: "Callback URL" }),
    method: z.string().openapi({ description: "HTTP method" }),
    response_status: z.number().nullable().openapi({ description: "HTTP response status code" }),
    success: z.boolean().openapi({ description: "Whether delivery was successful" }),
    error_message: z.string().nullable().openapi({ description: "Error message if failed" }),
    attempt_number: z.number().openapi({ description: "Retry attempt number" }),
    created_at: z.string().openapi({ description: "ISO 8601 timestamp" }),
  }).openapi("WebhookLogEntry"),
);

// ---------------------------------------------------------------------------
// Register input schemas
// ---------------------------------------------------------------------------

registry.register("CreateApprovalInput", createApprovalSchema);
registry.register("RespondApprovalInput", respondApprovalSchema);
registry.register("PaginationInput", paginationSchema);
registry.register("CreateConnectionInput", createConnectionSchema);
registry.register("UpdateConnectionInput", updateConnectionSchema);
registry.register("CreateTeamInput", createTeamSchema);
registry.register("UpdateTeamInput", updateTeamSchema);
registry.register("CreateRuleInput", createRuleSchema);
registry.register("BatchApprovalInput", batchApprovalSchema);
registry.register("CreateCommentInput", createCommentSchema);
registry.register("WebhookLogQuery", webhookLogQuerySchema);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// -- Approvals: List ---------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/approvals",
  summary: "List approval requests",
  description:
    "Retrieve a paginated list of approval requests for your organization. " +
    "Supports filtering by status, priority, date range, and full-text search.",
  tags: ["Approvals"],
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    query: z.object({
      page: z.number().optional().openapi({ description: "Page number (default 1)" }),
      page_size: z.number().optional().openapi({ description: "Items per page (default 20, max 100)" }),
      status: z.string().optional().openapi({ description: "Filter by status (comma-separated for multiple)" }),
      priority: z.string().optional().openapi({ description: "Filter by priority" }),
      search: z.string().optional().openapi({ description: "Full-text search query" }),
      created_after: z.string().optional().openapi({ description: "ISO 8601 datetime filter" }),
      created_before: z.string().optional().openapi({ description: "ISO 8601 datetime filter" }),
    }),
  },
  responses: {
    200: {
      description: "Paginated list of approval requests",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(ApprovalResponse),
          }).merge(PaginatedMeta),
        },
      },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Approvals: Create -------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/approvals",
  summary: "Create an approval request",
  description:
    "Submit a new approval request. Requires API key or OAuth authentication " +
    "(session auth is not allowed). The request will be evaluated against " +
    "auto-approve rules and trust thresholds.",
  tags: ["Approvals"],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: createApprovalSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Approval request created",
      content: { "application/json": { schema: ApprovalResponse } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponse } },
    },
    403: {
      description: "Authentication type not allowed or plan limit exceeded",
      content: { "application/json": { schema: ErrorResponse } },
    },
    429: {
      description: "Rate limit exceeded",
      content: { "application/json": { schema: ErrorResponse } },
    },
    503: {
      description: "Emergency stop is active",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Approvals: Get Single ---------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/approvals/{id}",
  summary: "Get a single approval request",
  description:
    "Retrieve details for a specific approval request by ID. Includes lazy " +
    "expiration, auto-action, and SLA breach checks.",
  tags: ["Approvals"],
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Approval request ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Approval request details",
      content: { "application/json": { schema: ApprovalResponse } },
    },
    404: {
      description: "Approval request not found",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Approvals: Respond (approve/reject) -------------------------------------

registry.registerPath({
  method: "patch",
  path: "/api/v1/approvals/{id}",
  summary: "Respond to an approval request",
  description:
    "Approve or reject a pending approval request. Requires session auth " +
    "(dashboard users only). Supports multi-approver workflows, sequential " +
    "approval chains, and scheduled execution.",
  tags: ["Approvals"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Approval request ID (UUID)" }),
    }),
    body: {
      required: true,
      content: {
        "application/json": { schema: respondApprovalSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Approval request updated",
      content: { "application/json": { schema: ApprovalResponse } },
    },
    400: {
      description: "Validation error or rejection reason required",
      content: { "application/json": { schema: ErrorResponse } },
    },
    403: {
      description: "Not authorized to respond (session required, not assigned, role too low, etc.)",
      content: { "application/json": { schema: ErrorResponse } },
    },
    409: {
      description: "Approval is not pending (already decided, expired, or auto-actioned)",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Approvals: Cancel -------------------------------------------------------

registry.registerPath({
  method: "delete",
  path: "/api/v1/approvals/{id}",
  summary: "Cancel an approval request",
  description:
    "Cancel a pending approval request or cancel a scheduled execution. " +
    "Requires session auth (dashboard users only).",
  tags: ["Approvals"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Approval request ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Approval request cancelled",
      content: { "application/json": { schema: ApprovalResponse } },
    },
    409: {
      description: "Approval is not pending",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Approvals: Batch --------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/approvals/batch",
  summary: "Batch approve or reject approval requests",
  description:
    "Approve or reject up to 50 approval requests in a single call. " +
    "Requires session auth.",
  tags: ["Approvals"],
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: batchApprovalSchema } },
    },
  },
  responses: {
    200: {
      description: "Batch operation results",
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(z.object({
              id: z.string(),
              success: z.boolean(),
              error: z.string().optional(),
            })),
          }),
        },
      },
    },
  },
});

// -- Approvals: Comments -----------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/approvals/{id}/comments",
  summary: "Add a comment to an approval request",
  tags: ["Approvals"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Approval request ID (UUID)" }),
    }),
    body: {
      required: true,
      content: { "application/json": { schema: createCommentSchema } },
    },
  },
  responses: {
    201: {
      description: "Comment created",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            body: z.string(),
            created_at: z.string(),
          }),
        },
      },
    },
  },
});

// -- Connections: List -------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/connections",
  summary: "List connections",
  description:
    "List all API key connections for your organization. " +
    "Requires session auth (dashboard users only). " +
    "API key hashes are never returned.",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  responses: {
    200: {
      description: "List of connections",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(ConnectionResponse) }),
        },
      },
    },
  },
});

// -- Connections: Create -----------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/connections",
  summary: "Create a connection",
  description:
    "Create a new API key connection. The plaintext API key is returned " +
    "only once in the response. Requires session auth and connect permission.",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createConnectionSchema } },
    },
  },
  responses: {
    201: {
      description: "Connection created with plaintext API key",
      content: {
        "application/json": {
          schema: z.object({
            data: ConnectionResponse,
            api_key: z.string().openapi({ description: "Plaintext API key (shown only once)" }),
            api_key_warning: z.string(),
          }),
        },
      },
    },
  },
});

// -- Connections: Get Single -------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/connections/{id}",
  summary: "Get a single connection",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Connection ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Connection details",
      content: { "application/json": { schema: ConnectionResponse } },
    },
    404: {
      description: "Connection not found",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Connections: Update -----------------------------------------------------

registry.registerPath({
  method: "patch",
  path: "/api/v1/connections/{id}",
  summary: "Update a connection",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Connection ID (UUID)" }),
    }),
    body: {
      required: true,
      content: { "application/json": { schema: updateConnectionSchema } },
    },
  },
  responses: {
    200: {
      description: "Connection updated",
      content: { "application/json": { schema: ConnectionResponse } },
    },
  },
});

// -- Connections: Delete -----------------------------------------------------

registry.registerPath({
  method: "delete",
  path: "/api/v1/connections/{id}",
  summary: "Delete a connection",
  description: "Permanently delete a connection and revoke its API key.",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Connection ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Connection deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

// -- Connections: Rotate Key -------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/connections/{id}/rotate",
  summary: "Rotate connection API key",
  description:
    "Generate a new API key for a connection. The old key is immediately " +
    "revoked. The new plaintext key is returned only once.",
  tags: ["Connections"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Connection ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "New API key generated",
      content: {
        "application/json": {
          schema: z.object({
            data: ConnectionResponse,
            api_key: z.string().openapi({ description: "New plaintext API key" }),
            api_key_warning: z.string(),
          }),
        },
      },
    },
  },
});

// -- Teams: List -------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/teams",
  summary: "List teams",
  description:
    "List all teams in your organization with member counts. " +
    "Supports session and OAuth auth (API keys are not allowed).",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  responses: {
    200: {
      description: "List of teams with member counts",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(TeamResponse) }),
        },
      },
    },
  },
});

// -- Teams: Create -----------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/teams",
  summary: "Create a team",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTeamSchema } },
    },
  },
  responses: {
    201: {
      description: "Team created",
      content: { "application/json": { schema: TeamResponse } },
    },
  },
});

// -- Teams: Get Single -------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/teams/{id}",
  summary: "Get a single team",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Team ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Team details with members",
      content: { "application/json": { schema: TeamResponse } },
    },
    404: {
      description: "Team not found",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Teams: Update -----------------------------------------------------------

registry.registerPath({
  method: "patch",
  path: "/api/v1/teams/{id}",
  summary: "Update a team",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Team ID (UUID)" }),
    }),
    body: {
      required: true,
      content: { "application/json": { schema: updateTeamSchema } },
    },
  },
  responses: {
    200: {
      description: "Team updated",
      content: { "application/json": { schema: TeamResponse } },
    },
  },
});

// -- Teams: Delete -----------------------------------------------------------

registry.registerPath({
  method: "delete",
  path: "/api/v1/teams/{id}",
  summary: "Delete a team",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Team ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Team deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

// -- Teams: Members ----------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/teams/{id}/members",
  summary: "List team members",
  tags: ["Teams"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Team ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "List of team members",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(z.object({
              user_id: z.string(),
              team_id: z.string(),
              full_name: z.string().nullable(),
              email: z.string(),
              role: z.string(),
            })),
          }),
        },
      },
    },
  },
});

// -- Rules: List -------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/rules",
  summary: "List approval rules",
  description:
    "List all approval rules for your organization, ordered by priority. " +
    "Requires session auth (dashboard users only).",
  tags: ["Rules"],
  security: [{ CookieAuth: [] }],
  responses: {
    200: {
      description: "List of approval rules",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(RuleResponse) }),
        },
      },
    },
  },
});

// -- Rules: Create -----------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/rules",
  summary: "Create an approval rule",
  description:
    "Create a new auto-approve or routing rule. Requires owner or admin role.",
  tags: ["Rules"],
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createRuleSchema } },
    },
  },
  responses: {
    201: {
      description: "Rule created",
      content: { "application/json": { schema: RuleResponse } },
    },
  },
});

// -- Rules: Get Single -------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/rules/{id}",
  summary: "Get a single approval rule",
  tags: ["Rules"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Rule ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Rule details",
      content: { "application/json": { schema: RuleResponse } },
    },
    404: {
      description: "Rule not found",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

// -- Rules: Delete -----------------------------------------------------------

registry.registerPath({
  method: "delete",
  path: "/api/v1/rules/{id}",
  summary: "Delete an approval rule",
  tags: ["Rules"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Rule ID (UUID)" }),
    }),
  },
  responses: {
    200: {
      description: "Rule deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

// -- Webhooks: Delivery Logs -------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/v1/webhooks",
  summary: "List webhook delivery logs",
  description:
    "View callback/webhook delivery logs for your organization. " +
    "Useful for debugging failed deliveries.",
  tags: ["Webhooks"],
  security: [{ CookieAuth: [] }],
  request: {
    query: z.object({
      request_id: z.string().optional().openapi({ description: "Filter by approval request ID" }),
      status: z.string().optional().openapi({ description: "Filter by status: success or failed" }),
      limit: z.number().optional().openapi({ description: "Number of records (default 20, max 100)" }),
      offset: z.number().optional().openapi({ description: "Offset for pagination" }),
    }),
  },
  responses: {
    200: {
      description: "Webhook delivery log entries",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(WebhookLogEntry),
            total: z.number(),
          }),
        },
      },
    },
  },
});

// -- Webhooks: Replay --------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/v1/webhooks/{id}/replay",
  summary: "Replay a webhook delivery",
  description: "Re-deliver a previously failed webhook/callback.",
  tags: ["Webhooks"],
  security: [{ CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Webhook log entry ID" }),
    }),
  },
  responses: {
    200: {
      description: "Webhook replayed",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Generate the OpenAPI document
// ---------------------------------------------------------------------------

export function generateOpenAPISpec() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://okrunit.com";

  const generator = new OpenApiGeneratorV31(registry.definitions);

  const doc = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "OKrunit API",
      version: "1.0.0",
      description:
        "OKrunit is a human-in-the-loop approval gateway for automated workflows. " +
        "Use this API to create approval requests from your automation tools, " +
        "manage connections, teams, rules, and view webhook delivery logs.\n\n" +
        "## Authentication\n\n" +
        "The API supports two authentication methods:\n\n" +
        "- **Bearer Token (API Key)**: Used by automation tools to create approval requests. " +
        "Include the API key in the `Authorization: Bearer <key>` header.\n" +
        "- **Session Cookie**: Used by dashboard users for management operations " +
        "(responding to approvals, managing connections, teams, and rules).\n\n" +
        "## Rate Limiting\n\n" +
        "API key connections are rate-limited per connection (configurable, default 100/hour). " +
        "Rate limit info is returned in `X-RateLimit-*` response headers.",
      contact: {
        name: "OKrunit Support",
        url: "https://okrunit.com",
      },
    },
    servers: [{ url: baseUrl }],
  });

  return doc;
}
