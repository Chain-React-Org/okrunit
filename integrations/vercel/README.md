# OKRunit Approval Gate -- Vercel

Gate Vercel deployments behind human approval using [OKRunit](https://okrunit.com). Prevents production deployments from going live until a human approves them.

## Quick Start

```bash
npm install @okrunit/vercel
```

### As a CLI tool

```bash
export OKRUNIT_API_KEY="gk_your_api_key_here"

npx @okrunit/vercel approve --title "Deploy to production" --priority critical
```

### As a library

```typescript
import { requestApproval } from "@okrunit/vercel";

const result = await requestApproval({
  apiKey: process.env.OKRUNIT_API_KEY!,
  title: "Deploy to production",
  priority: "critical",
});

if (result.status !== "approved") {
  console.error(`Deployment blocked: ${result.status}`);
  process.exit(1);
}

console.log(`Approved by ${result.decidedBy}`);
```

## Usage Patterns

### Vercel Build Command

Add an approval step to your Vercel project's build command. In your `package.json`:

```json
{
  "scripts": {
    "build": "npx @okrunit/vercel approve --priority high && next build"
  }
}
```

Then set `OKRUNIT_API_KEY` in your Vercel project's environment variables. The integration automatically picks up Vercel's deployment context (project, environment, git ref, etc.).

### GitHub Actions + Vercel

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Request deployment approval
        env:
          OKRUNIT_API_KEY: ${{ secrets.OKRUNIT_API_KEY }}
          VERCEL_ENV: production
          VERCEL_GIT_COMMIT_REF: ${{ github.ref_name }}
          VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}
          VERCEL_GIT_COMMIT_MESSAGE: ${{ github.event.head_commit.message }}
          VERCEL_GIT_REPO_SLUG: ${{ github.repository }}
        run: npx @okrunit/vercel approve --title "Deploy ${{ github.ref_name }} to production" --priority critical

      - name: Deploy to Vercel
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Programmatic (custom build script)

```typescript
import { requestApproval } from "@okrunit/vercel";

async function deploy() {
  // Request approval before deploying
  const approval = await requestApproval({
    apiKey: process.env.OKRUNIT_API_KEY!,
    title: `Deploy ${process.env.VERCEL_GIT_COMMIT_REF} to production`,
    description: `Commit: ${process.env.VERCEL_GIT_COMMIT_MESSAGE}`,
    priority: "high",
    metadata: {
      deployer: process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME,
      sha: process.env.VERCEL_GIT_COMMIT_SHA,
    },
    timeout: 1800, // 30 minutes
  });

  if (approval.status !== "approved") {
    throw new Error(`Deployment ${approval.status}`);
  }

  // Proceed with deployment...
}
```

## CLI Reference

```
npx @okrunit/vercel approve [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--title` | Auto-generated | Approval request title |
| `--description` | Auto-generated | Context for the reviewer |
| `--priority` | `medium` | `low`, `medium`, `high`, `critical` |
| `--metadata` | -- | JSON string with additional context |
| `--timeout` | `3600` | Max wait time in seconds |
| `--poll-interval` | `10` | Seconds between status checks |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OKRUNIT_API_KEY` | Yes | -- | API key (starts with `gk_`) |
| `OKRUNIT_API_URL` | No | `https://app.okrunit.com` | OKRunit instance URL |

The integration also reads Vercel environment variables automatically:

- `VERCEL_ENV` -- Deployment environment (production, preview, development)
- `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` -- Project URL
- `VERCEL_GIT_COMMIT_REF` -- Git branch/tag
- `VERCEL_GIT_COMMIT_SHA` -- Commit hash
- `VERCEL_GIT_COMMIT_MESSAGE` -- Commit message
- `VERCEL_GIT_COMMIT_AUTHOR_NAME` -- Commit author
- `VERCEL_GIT_REPO_SLUG` -- Repository name
- `VERCEL_GIT_PROVIDER` -- Git provider (github, gitlab, bitbucket)

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

1. Creates an approval request via `POST /api/v1/approvals` with `source: "vercel"`
2. Idempotency key generated from project name, environment, and git SHA
3. Vercel deployment context automatically included in metadata
4. Polls `GET /api/v1/approvals/{id}` until decided or timeout
5. **Approved**: exits 0 / returns approved result
6. **Rejected**: exits 1 / returns rejected result
7. **Timeout**: exits 1 / returns timeout result
