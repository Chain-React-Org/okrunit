# OKRunit Approval Gate -- Retool

Embed human approval gates in [Retool](https://retool.com) apps and workflows using [OKRunit](https://okrunit.com). Gate destructive or sensitive actions behind human review before they execute.

## Quick Start

```bash
npm install @okrunit/retool
```

### In a Retool Workflow (JavaScript Query)

```typescript
import { requestApproval } from "@okrunit/retool";

const result = await requestApproval({
  apiKey: retoolContext.configVars.OKRUNIT_API_KEY,
  title: "Delete 500 user records",
  description: "Bulk deletion requested via admin panel",
  priority: "critical",
  metadata: {
    affected_users: 500,
    requested_by: currentUser.email,
  },
});

if (result.status !== "approved") {
  throw new Error(`Action blocked: ${result.status}`);
}

// Proceed with the destructive action...
```

### As a Retool Custom Component

```tsx
import { OKRunitApproval } from "@okrunit/retool/component";

function MyApprovalWidget({ approvalId }) {
  return (
    <OKRunitApproval
      apiKey={OKRUNIT_API_KEY}
      approvalId={approvalId}
      canDecide={true}
      onStatusChange={(status) => {
        if (status === "approved") {
          // Trigger downstream action
        }
      }}
    />
  );
}
```

## Usage Patterns

### Gate a Retool Action

Use `requestApproval()` in a JavaScript query that runs before your actual mutation:

```typescript
// Step 1: Request approval
const approval = await requestApproval({
  apiKey: retoolContext.configVars.OKRUNIT_API_KEY,
  title: `Transfer $${amount} to ${recipient}`,
  priority: "high",
  timeout: 300, // 5 minute timeout
});

if (approval.status !== "approved") {
  throw new Error("Transfer was not approved");
}

// Step 2: Execute the transfer
await transferFunds(amount, recipient);
```

### Inline Approval Status

Use the React component to display approval status directly in your Retool app:

```tsx
<OKRunitApproval
  apiKey="gk_your_api_key"
  approvalId={selectedApproval.id}
  canDecide={currentUser.role === "admin"}
  refreshInterval={10}
  onStatusChange={(status) => console.log("Status:", status)}
/>
```

### Check Approval Status (Non-Blocking)

If you want to check status without polling in a loop:

```typescript
import { getApprovalStatus } from "@okrunit/retool";

const status = await getApprovalStatus({
  apiKey: retoolContext.configVars.OKRUNIT_API_KEY,
  approvalId: "550e8400-e29b-41d4-a716-446655440000",
});

if (status.status === "approved") {
  // Proceed
}
```

## API Reference

### `requestApproval(options: ApprovalOptions): Promise<ApprovalResult>`

Creates an approval request and polls until a decision is made.

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | -- | OKRunit API key |
| `apiUrl` | `string` | No | `https://app.okrunit.com` | Instance URL |
| `title` | `string` | No | `"Approval request from Retool"` | Approval title |
| `description` | `string` | No | -- | Reviewer context |
| `priority` | `string` | No | `medium` | `low`, `medium`, `high`, `critical` |
| `metadata` | `object` | No | -- | Additional metadata |
| `timeout` | `number` | No | `3600` | Max wait seconds |
| `pollInterval` | `number` | No | `10` | Poll interval seconds |

### `getApprovalStatus(options): Promise<ApprovalResult>`

Fetches current status of an approval without polling.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | OKRunit API key |
| `apiUrl` | `string` | No | Instance URL |
| `approvalId` | `string` | Yes | Approval UUID |

### `ApprovalResult`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Approval request UUID |
| `status` | `"approved" \| "rejected" \| "timeout"` | Decision status |
| `decidedBy` | `string?` | Name of the decider |
| `decidedAt` | `string?` | ISO timestamp |
| `comment` | `string?` | Decider's comment |

### `<OKRunitApproval />` Component

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | -- | OKRunit API key |
| `apiUrl` | `string` | No | `https://app.okrunit.com` | Instance URL |
| `approvalId` | `string` | Yes | -- | Approval UUID to display |
| `canDecide` | `boolean` | No | `false` | Show approve/reject buttons |
| `refreshInterval` | `number` | No | `15` | Auto-refresh seconds (0 to disable) |
| `onStatusChange` | `function` | No | -- | Called when status changes |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OKRUNIT_API_KEY` | Yes | -- | API key (starts with `gk_`) |
| `OKRUNIT_API_URL` | No | `https://app.okrunit.com` | OKRunit instance URL |

## Behavior

1. Creates an approval request via `POST /api/v1/approvals` with `source: "retool"`
2. Idempotency key auto-generated as `retool-{timestamp}-{random}`
3. Polls `GET /api/v1/approvals/{id}` until decided or timeout
4. **Approved**: returns approved result
5. **Rejected**: returns rejected result
6. **Timeout**: returns timeout result
7. The React component auto-refreshes and provides inline approve/reject controls
