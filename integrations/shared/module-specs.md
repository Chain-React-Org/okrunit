# OKRunit Integration Module Specifications

Canonical reference for all platform integrations (Zapier, Make, n8n, Windmill, Pipedream, GitHub Actions, Temporal, Prefect, Dagster).
Every integration must implement these modules with matching fields, filters, and behavior.

---

## Modules Overview

| Module            | Type    | Description                                              | Required Scope    |
|-------------------|---------|----------------------------------------------------------|-------------------|
| newApproval       | Trigger | Watch for new approval requests in your organization     | approvals:read    |
| approvalDecided   | Trigger | Watch for approvals that have been approved or rejected  | approvals:read    |
| requestApproval   | Action  | Request an approval and wait for a decision              | approvals:write   |
| addComment        | Action  | Add a comment to an approval request                     | comments:write    |
| getApproval       | Search  | Get details of a specific approval by ID                 | approvals:read    |
| listApprovals     | Search  | Search and list approval requests with filters           | approvals:read    |

---

## Trigger: newApproval

**Label:** New Approval Request
**Description:** Watch for new approval requests in your organization
**Endpoint:** `GET /api/v1/approvals`
**Sort:** `created_at` descending
**Deduplication:** By `id`

### Filters (user-configurable)

| Name     | Type   | Label    | Required | Default | Options                                            |
|----------|--------|----------|----------|---------|----------------------------------------------------|
| status   | select | Status   | no       | (all)   | All, Pending, Approved, Rejected, Cancelled, Expired |
| priority | select | Priority | no       | (all)   | All, Low, Medium, High, Critical                   |

### Output Fields

| Field              | Type     | Label              |
|--------------------|----------|--------------------|
| id                 | text     | Approval ID        |
| title              | text     | Title              |
| description        | text     | Description        |
| status             | text     | Status             |
| priority           | text     | Priority           |
| action_type        | text     | Action Type        |
| source             | text     | Source             |
| required_approvals | integer  | Required Approvals |
| current_approvals  | integer  | Current Approvals  |
| requested_by_name  | text     | Requested By       |
| created_at         | datetime | Created At         |
| updated_at         | datetime | Updated At         |

### Sample Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Deploy v2.3.1 to production",
  "description": "Release includes new payment flow",
  "status": "pending",
  "priority": "high",
  "action_type": "deploy",
  "source": "api",
  "required_approvals": 1,
  "current_approvals": 0,
  "requested_by_name": "Jane Smith",
  "created_at": "2026-02-21T10:00:00.000Z",
  "updated_at": "2026-02-21T10:00:00.000Z"
}
```

---

## Trigger: approvalDecided

**Label:** Approval Decided
**Description:** Triggers when an approval request is approved or rejected
**Endpoint:** `GET /api/v1/approvals`
**Sort:** `updated_at` descending
**Deduplication:** By `id`

### Filters (user-configurable)

| Name     | Type   | Label         | Required | Default            | Options                                       |
|----------|--------|---------------|----------|--------------------|-----------------------------------------------|
| decision | select | Decision Type | no       | approved,rejected  | Approved or Rejected, Approved Only, Rejected Only |
| priority | select | Priority      | no       | (all)              | All, Low, Medium, High, Critical              |

### Output Fields

| Field              | Type     | Label                |
|--------------------|----------|----------------------|
| id                 | text     | Approval ID          |
| title              | text     | Title                |
| description        | text     | Description          |
| status             | text     | Decision             |
| priority           | text     | Priority             |
| source             | text     | Source               |
| decided_by         | text     | Decided By (User ID) |
| decided_by_name    | text     | Decided By (Name)    |
| decided_at         | datetime | Decided At           |
| decision_comment   | text     | Comment              |
| created_at         | datetime | Created At           |
| updated_at         | datetime | Updated At           |

### Sample Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Deploy v2.3.1 to production",
  "description": "Release includes new payment flow",
  "status": "approved",
  "priority": "high",
  "source": "api",
  "decided_by": "770e8400-e29b-41d4-a716-446655440002",
  "decided_by_name": "Jane Smith",
  "decided_at": "2026-02-21T10:30:00.000Z",
  "decision_comment": "Looks good, approved!",
  "created_at": "2026-02-21T10:00:00.000Z",
  "updated_at": "2026-02-21T10:30:00.000Z"
}
```

---

## Action: requestApproval

**Label:** Request Approval
**Description:** Request an approval and wait for a decision via callback webhook
**Endpoint:** `POST /api/v1/approvals`
**Behavior:** Creates an approval request. Optionally accepts a callback URL for pause-and-wait workflows (Zapier's `performResume`, Make's webhook scenario). Sets `source` to the platform name (e.g., "zapier", "make").

### Input Fields (user-mappable)

| Name        | Type | Label           | Required | Help                                                           |
|-------------|------|-----------------|----------|----------------------------------------------------------------|
| title       | text | Title           | no*      | Short title for the approval. Defaults to "Approval request from {platform}" if blank. |
| description | text | Description     | no       | Additional context for the reviewer.                           |
| callbackUrl | url  | Callback URL    | no       | Webhook URL to receive the decision.                           |
| metadata    | text | Metadata (JSON) | no       | Optional JSON data to attach to the approval.                  |

\* Title is technically optional. If omitted, a default is generated. Some platforms (like Zapier) make it optional, others may require it.

### Request Body (sent to API)

```json
{
  "title": "{title or default}",
  "description": "{description}",
  "callback_url": "{callbackUrl}",
  "metadata": "{parsed JSON}",
  "source": "{platform}",
  "idempotency_key": "{auto-generated}"
}
```

### Output Fields

| Field              | Type     | Label                |
|--------------------|----------|----------------------|
| id                 | text     | Approval ID          |
| title              | text     | Title                |
| description        | text     | Description          |
| status             | text     | Status               |
| priority           | text     | Priority             |
| source             | text     | Source               |
| decided_by         | text     | Decided By (User ID) |
| decided_by_name    | text     | Decided By (Name)    |
| decision_comment   | text     | Comment              |
| created_at         | datetime | Created At           |
| decided_at         | datetime | Decided At           |

### Sample Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Deploy v2.3.1 to production",
  "description": "Release includes new payment flow",
  "status": "pending",
  "priority": "medium",
  "source": "make",
  "decided_by": null,
  "decided_by_name": null,
  "decision_comment": null,
  "created_at": "2026-02-21T10:00:00.000Z",
  "decided_at": null
}
```

### Callback Response Fields (sent back when decision is made)

When the approval is decided, OKRunit POSTs to the callback URL with:

| Field            | Description                        |
|------------------|------------------------------------|
| id               | Approval ID                        |
| title            | Title of the approval              |
| status           | "approved" or "rejected"           |
| priority         | Priority level                     |
| decided_by       | User ID of the decider             |
| decided_by_name  | Display name of the decider        |
| decision_comment | Optional comment from the decider  |
| metadata         | Original metadata                  |
| decided_at       | ISO 8601 timestamp of the decision |

---

## Action: addComment

**Label:** Add Comment
**Description:** Add a comment to an approval request
**Endpoint:** `POST /api/v1/approvals/{approvalId}/comments`

### Input Fields (user-mappable)

| Name       | Type | Label       | Required | Help                                      |
|------------|------|-------------|----------|--------------------------------------------|
| approvalId | text | Approval ID | yes      | The UUID of the approval request.          |
| comment    | text | Comment     | yes      | The comment text to add (max 5000 chars).  |

### Request Body (sent to API)

```json
{
  "body": "{comment}"
}
```

### Output Fields

| Field       | Type     | Label       |
|-------------|----------|-------------|
| id          | text     | Comment ID  |
| approval_id | text    | Approval ID |
| body        | text     | Comment     |
| created_by  | text     | Created By  |
| created_at  | datetime | Created At  |

### Sample Data

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "approval_id": "550e8400-e29b-41d4-a716-446655440000",
  "body": "Looks good, proceeding with approval.",
  "created_by": "770e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-02-21T10:05:00.000Z"
}
```

---

## Search: getApproval

**Label:** Get Approval Request
**Description:** Fetch a single approval request by its ID
**Endpoint:** `GET /api/v1/approvals/{approvalId}`

### Input Fields (user-mappable)

| Name       | Type | Label       | Required | Help                             |
|------------|------|-------------|----------|----------------------------------|
| approvalId | text | Approval ID | yes      | The UUID of the approval request. |

### Output Fields

| Field              | Type     | Label                |
|--------------------|----------|----------------------|
| id                 | text     | Approval ID          |
| title              | text     | Title                |
| description        | text     | Description          |
| status             | text     | Status               |
| priority           | text     | Priority             |
| action_type        | text     | Action Type          |
| source             | text     | Source               |
| required_approvals | integer  | Required Approvals   |
| current_approvals  | integer  | Current Approvals    |
| requested_by_name  | text     | Requested By         |
| decided_by         | text     | Decided By (User ID) |
| decided_by_name    | text     | Decided By (Name)    |
| decided_at         | datetime | Decided At           |
| decision_comment   | text     | Comment              |
| created_at         | datetime | Created At           |
| updated_at         | datetime | Updated At           |

### Sample Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Deploy v2.3.1 to production",
  "description": "Release includes new payment flow",
  "status": "approved",
  "priority": "high",
  "action_type": "deploy",
  "source": "api",
  "required_approvals": 1,
  "current_approvals": 1,
  "requested_by_name": "Jane Smith",
  "decided_by": "770e8400-e29b-41d4-a716-446655440002",
  "decided_by_name": "John Doe",
  "decided_at": "2026-02-21T10:30:00.000Z",
  "decision_comment": "Looks good, ship it!",
  "created_at": "2026-02-21T10:00:00.000Z",
  "updated_at": "2026-02-21T10:30:00.000Z"
}
```

---

## Search: listApprovals

**Label:** Find Approvals
**Description:** Search for approval requests with filters
**Endpoint:** `GET /api/v1/approvals`

### Input Fields (user-mappable)

| Name     | Type    | Label    | Required | Default | Help                                    |
|----------|---------|----------|----------|---------|-----------------------------------------|
| status   | select  | Status   | no       | (all)   | Filter by status                        |
| priority | select  | Priority | no       | (all)   | Filter by priority                      |
| search   | text    | Search   | no       |         | Full-text search on title/description   |
| limit    | integer | Limit    | no       | 25      | Maximum number of results               |

### Status Options

- All (no filter)
- Pending
- Approved
- Rejected
- Cancelled
- Expired

### Priority Options

- All (no filter)
- Low
- Medium
- High
- Critical

### Output Fields

Same as [getApproval](#search-getapproval).

### Sample Data

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Deploy v2.3.1 to production",
  "description": "Release includes new payment flow",
  "status": "pending",
  "priority": "high",
  "action_type": "deploy",
  "source": "api",
  "required_approvals": 1,
  "current_approvals": 0,
  "requested_by_name": "Jane Smith",
  "decided_by": null,
  "decided_by_name": null,
  "decided_at": null,
  "decision_comment": null,
  "created_at": "2026-02-21T10:00:00.000Z",
  "updated_at": "2026-02-21T10:00:00.000Z"
}
```

---

## Platform-Specific Notes

### Zapier
- Uses `performResume` for pause-and-wait on `requestApproval`
- Callback URL auto-generated via `z.generateCallbackUrl()`
- Source set to `"zapier"`
- Idempotency key format: `zap-{zapId}-{timestamp}-{random}`
- Hidden triggers (`actionTypes`, `teamMembers`, `teams`) power dynamic dropdowns

### Make.com
- No native pause-and-wait; uses two-scenario pattern with webhook trigger
- Callback URL manually provided by user (Make webhook URL)
- Source set to `"make"`
- Idempotency key format: `make-{title}-{timestamp}`
- Module names must match pattern `/^[a-zA-Z][0-9a-zA-Z]+[0-9a-zA-Z]$/` (no underscores)
- Scopes defined as object: `{"approvals:read": "Read Approvals", ...}`

### n8n
- Source set to `"n8n"`
- Idempotency key format: `n8n-{timestamp}-{random}`
- Uses n8n webhook node for callback pattern
- Community node: `n8n-nodes-okrunit`
- CLI: `npm install n8n-nodes-okrunit` in `~/.n8n`

### Windmill
- Source set to `"windmill"`
- Idempotency key format: `windmill-{timestamp}-{random}`
- Script-based integration using Deno TypeScript
- Resource type: `gatekeeper` (api_key + api_url)
- CLI: `wmill sync push` to deploy, `wmill script run` to execute

### Pipedream
- Source set to `"pipedream"`
- Idempotency key format: `pipedream-{timestamp}-{random}`
- Component-based architecture (defineAction, defineSource)
- Uses `@pipedream/platform` axios for HTTP
- CLI: `pd deploy` to publish, `pd action run` to test

### GitHub Actions
- Source set to `"github-actions"`
- Idempotency key format: `gha-{runId}-{runNumber}-{timestamp}`
- Polling-based (no callback); action polls until decided or timeout
- Auto-includes GitHub context in metadata (repo, workflow, actor, ref, sha)
- Default title: `"Approval required: {workflow} #{runNumber}"`
- CLI: `gh workflow run` to trigger, `gh run watch` to monitor

### Temporal
- Source set to `"temporal"`
- Idempotency key format: `temporal-{timestamp}-{random}`
- Python SDK with activities and durable workflows
- `ApprovalGateWorkflow` with `current_status` query
- CLI: `temporal workflow start` to create, `temporal workflow query` to check

### Prefect
- Source set to `"prefect"`
- Idempotency key format: `prefect-{timestamp}-{random}`
- Python tasks and flows using Prefect 3.x
- API key resolved from Prefect Secret block `okrunit-api-key`
- CLI: `prefect flow-run create` to run, `prefect deploy` to schedule

### Dagster
- Source set to `"dagster"`
- Idempotency key format: `dagster-{timestamp}-{random}`
- `OKRunitResource` (ConfigurableResource) with ops and sensors
- `approval_decided_sensor` polls for decisions and triggers runs
- CLI: `dagster dev` to start, `dagster job launch` to run

### General Rules
- All integrations must use OAuth 2.0 for authentication
- All approval creation actions must set `source` to the platform name
- All approval creation actions must auto-generate an idempotency key
- All output field sets must match the canonical specs above
- Filter options must include all statuses (pending, approved, rejected, cancelled, expired)
- Priority filter options must include all levels (low, medium, high, critical)
