# OKRunit Approval Gate -- Netlify

Gate Netlify deployments behind human approval using [OKRunit](https://okrunit.com). Prevents builds from completing until a human approves them. Rejected or timed-out requests fail the build.

## Quick Start

Install the plugin:

```bash
npm install @okrunit/netlify
```

Add to your `netlify.toml`:

```toml
[[plugins]]
  package = "@okrunit/netlify"
  [plugins.inputs]
    priority = "high"
    branches = "main,production"
```

Set `OKRUNIT_API_KEY` in your Netlify site's environment variables (Site settings > Environment variables).

## Configuration

### `netlify.toml` Plugin Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `api_key` | `OKRUNIT_API_KEY` env var | OKRunit API key (starts with `gk_`) |
| `api_url` | `https://app.okrunit.com` | OKRunit instance URL |
| `title` | Auto-generated | Approval request title |
| `description` | Auto-generated | Context for the reviewer |
| `priority` | `medium` | `low`, `medium`, `high`, `critical` |
| `timeout` | `3600` | Max wait time in seconds |
| `poll_interval` | `10` | Seconds between status checks |
| `branches` | (all) | Comma-separated branches requiring approval |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OKRUNIT_API_KEY` | Yes | -- | API key (starts with `gk_`) |
| `OKRUNIT_API_URL` | No | `https://app.okrunit.com` | OKRunit instance URL |

The plugin also auto-detects these Netlify environment variables:

- `SITE_NAME` -- Netlify site name
- `SITE_ID` -- Netlify site ID
- `BRANCH` -- Git branch being deployed
- `HEAD` -- Git HEAD ref
- `COMMIT_REF` -- Git commit SHA
- `CONTEXT` -- Deploy context (production, deploy-preview, branch-deploy)
- `DEPLOY_URL` -- Unique deploy URL
- `DEPLOY_PRIME_URL` -- Primary deploy URL
- `DEPLOY_ID` -- Deploy ID
- `BUILD_ID` -- Build ID
- `URL` -- Primary site URL
- `REPOSITORY_URL` -- Git repository URL
- `PULL_REQUEST` -- Whether this is a PR deploy
- `REVIEW_ID` -- PR number (if applicable)

## Usage Patterns

### Require Approval for Production Only

```toml
[[plugins]]
  package = "@okrunit/netlify"
  [plugins.inputs]
    priority = "critical"
    branches = "main"
    timeout = 1800
```

### Require Approval for All Branches

```toml
[[plugins]]
  package = "@okrunit/netlify"
  [plugins.inputs]
    priority = "medium"
```

### Custom Title and Description

```toml
[[plugins]]
  package = "@okrunit/netlify"
  [plugins.inputs]
    title = "Production deploy requires approval"
    description = "Review the deploy preview before approving"
    priority = "high"
```

### Programmatic Usage (Library)

You can also use `requestApproval()` directly in custom Netlify build scripts:

```typescript
import { requestApproval } from "@okrunit/netlify";

const result = await requestApproval({
  apiKey: process.env.OKRUNIT_API_KEY!,
  title: "Deploy to production",
  priority: "critical",
  timeout: 1800,
});

if (result.status !== "approved") {
  console.error(`Deployment blocked: ${result.status}`);
  process.exit(1);
}
```

## API Reference

### `requestApproval(options: ApprovalOptions): Promise<ApprovalResult>`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | -- | OKRunit API key |
| `apiUrl` | `string` | No | `https://app.okrunit.com` | Instance URL |
| `title` | `string` | No | Auto-generated | Approval title |
| `description` | `string` | No | Auto-generated | Reviewer context |
| `priority` | `string` | No | `medium` | Priority level |
| `metadata` | `object` | No | -- | Additional metadata |
| `timeout` | `number` | No | `3600` | Max wait seconds |
| `pollInterval` | `number` | No | `10` | Poll interval seconds |

### `ApprovalResult`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Approval request UUID |
| `status` | `"approved" \| "rejected" \| "timeout"` | Decision status |
| `decidedBy` | `string?` | Name of the decider |
| `decidedAt` | `string?` | ISO timestamp |
| `comment` | `string?` | Decider's comment |

## Behavior

1. Runs in the `onPreBuild` hook -- before any build steps execute
2. Checks branch filtering -- skips approval if the current branch is not in the `branches` list
3. Creates an approval request via `POST /api/v1/approvals` with `source: "netlify"`
4. Idempotency key generated from build ID and commit ref
5. Netlify deployment context automatically included in metadata
6. Polls `GET /api/v1/approvals/{id}` until decided or timeout
7. **Approved**: build proceeds normally
8. **Rejected**: build fails with rejection message
9. **Timeout**: build fails with timeout message
