# OKRunit Approval Gate - GitHub Action

A GitHub Action that pauses a workflow until a human approves or rejects via [OKRunit](https://okrunit.com).

## Quick Start

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Request deployment approval
        id: approval
        uses: okrunit/approval-gate@v1
        with:
          api-key: ${{ secrets.OKRUNIT_API_KEY }}
          title: "Deploy ${{ github.ref_name }} to production"
          description: "Commit: ${{ github.event.head_commit.message }}"
          priority: high
          timeout: 1800

      - name: Deploy
        run: |
          echo "Approved by ${{ steps.approval.outputs.decided-by }}"
          echo "Deploying..."
```

## Inputs

### Core

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | - | OKRunit API key (`gk_...`) |
| `api-url` | No | `https://app.okrunit.com` | OKRunit instance URL |
| `title` | No | Auto-generated | Approval title (defaults to workflow name) |
| `description` | No | - | Context for the reviewer |
| `action-type` | No | - | Type of action (e.g. `deploy`, `release`, `data-delete`) |
| `priority` | No | `medium` | `low`, `medium`, `high`, or `critical` |
| `metadata` | No | - | JSON metadata (merged with GitHub context) |
| `context-html` | No | - | Rich HTML context for reviewers (diffs, logs, etc). Max 50KB |
| `timeout` | No | `3600` | Max wait time in seconds |
| `poll-interval` | No | `10` | Polling interval in seconds |

### Routing & Approvers

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `required-approvals` | No | `1` | Number of approvals needed (1-10) |
| `assigned-approvers` | No | - | Comma-separated OKRunit user IDs to assign |
| `assigned-team-id` | No | - | OKRunit team ID to route the approval to |
| `is-sequential` | No | `false` | Multi-step approvals must happen in order |

### Auto-Action & Expiration

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `auto-action` | No | - | Auto-action on timeout: `approve` or `reject` |
| `auto-action-after-minutes` | No | - | Minutes before auto-action triggers (1-43200) |
| `expires-at` | No | - | ISO datetime when the request expires |

### Callbacks & Notifications

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `callback-url` | No | - | URL to POST the decision to |
| `callback-headers` | No | - | JSON object of custom headers for the callback |
| `notify-channel-ids` | No | - | Comma-separated messaging channel IDs (Slack, Teams, etc.) |

### Conditions & Policies

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `conditions` | No | - | JSON array of conditions (`[{name, check_type, webhook_url}]`) |
| `require-rejection-reason` | No | `false` | Require comment when rejecting |

## Outputs

| Output | Description |
|--------|-------------|
| `approval-id` | The approval request UUID |
| `status` | `approved`, `rejected`, `cancelled`, `expired`, or `timeout` |
| `description` | Description of the approval request |
| `priority` | Priority level |
| `source` | Source platform (`github-actions`) |
| `action-type` | Action type of the approval |
| `required-approvals` | Number of required approvals |
| `current-approvals` | Number of current approvals |
| `updated-at` | ISO timestamp of the last update |
| `decided-by` | Name of the decider |
| `decided-at` | ISO timestamp of the decision |
| `decision-comment` | Comment from the decider |
| `decision-source` | How the decision was made (`dashboard`, `email`, `slack`, `api`, `auto_rule`, etc.) |
| `risk-score` | Calculated risk score (0-100) |
| `risk-level` | Risk level (`low`, `medium`, `high`, `critical`) |
| `auto-approved` | Whether the request was auto-approved |
| `execution-status` | `immediate`, `scheduled`, `executed`, or `cancelled` |
| `conditions-met` | Whether all conditions have been satisfied |
| `sla-breached` | Whether the SLA deadline was breached |
| `expires-at` | ISO datetime when the request expires |
| `metadata` | JSON string of all metadata attached to the approval |

## Behavior

- **Approved**: The step succeeds, downstream steps run
- **Rejected**: The step fails with the rejection comment as the error
- **Cancelled**: The step fails (request was cancelled in OKRunit)
- **Expired**: The step fails (request expired before a decision)
- **Timeout**: The step fails with a timeout message (action-side timeout)

GitHub context (repo, workflow, run ID, actor, ref, SHA) is automatically included in the approval metadata. A `source_url` linking back to the GitHub Actions run is also included.

## Examples

### Multi-Approver Deploy Gate

```yaml
- name: Approval gate
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Deploy to production"
    priority: critical
    required-approvals: "2"
    assigned-team-id: "your-team-uuid"
    is-sequential: "true"
```

### Auto-Approve After 30 Minutes

```yaml
- name: Approval gate
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Staging deploy"
    priority: low
    auto-action: approve
    auto-action-after-minutes: "30"
```

### With Callback and Conditions

```yaml
- name: Approval gate
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Data migration"
    priority: high
    callback-url: "https://api.example.com/hooks/deploy"
    callback-headers: '{"Authorization": "Bearer ${{ secrets.HOOK_TOKEN }}"}'
    conditions: '[{"name": "health-check", "check_type": "webhook", "webhook_url": "https://api.example.com/health"}]'
    require-rejection-reason: "true"
```

### With Slack Notifications

```yaml
- name: Approval gate
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Release v${{ github.ref_name }}"
    notify-channel-ids: "slack-channel-uuid-1, slack-channel-uuid-2"
```

### Rich HTML Context

```yaml
- name: Generate diff
  id: diff
  run: echo "html=<pre>$(git diff HEAD~1 --stat)</pre>" >> "$GITHUB_OUTPUT"

- name: Approval gate
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Review changes"
    context-html: ${{ steps.diff.outputs.html }}
```

### Conditional Approval (Production Only)

```yaml
- name: Approval gate
  if: github.ref == 'refs/heads/main'
  uses: okrunit/approval-gate@v1
  with:
    api-key: ${{ secrets.OKRUNIT_API_KEY }}
    title: "Production deploy: ${{ github.event.head_commit.message }}"
    priority: critical
```

## CLI Workflow

Use the `gh` CLI for a seamless experience:

```bash
# Store your API key as a repo secret
gh secret set OKRUNIT_API_KEY

# Trigger a workflow that includes an approval gate
gh workflow run deploy.yml

# Watch the run (will show "waiting for approval" status)
gh run watch

# Check the latest run status
gh run list --workflow=deploy.yml --limit=5

# View run details including approval outputs
gh run view <run-id>
```

## Development

```bash
cd integrations/github-actions
npm install
npm run build

# The dist/ folder must be committed for GitHub Actions
git add dist/
```

## Publishing

1. Create a separate repo (e.g., `okrunit/approval-gate`)
2. Copy the contents of this directory
3. Run `npm install && npm run build`
4. Commit everything including `dist/`
5. Tag a release: `git tag v1 && git push --tags`
