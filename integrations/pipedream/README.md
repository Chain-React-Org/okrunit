# OKRunit Pipedream Integration

Pipedream components for [OKRunit](https://okrunit.com), a human-in-the-loop approval gateway for automated workflows.

## CLI Setup

```bash
# Install the Pipedream CLI
npm i -g @pipedream/cli

# Authenticate
pd login

# Deploy the app component
pd deploy components/okrunit.app.mts

# Deploy actions
pd deploy actions/create-approval/create-approval.mts
pd deploy actions/get-approval/get-approval.mts
pd deploy actions/list-approvals/list-approvals.mts
pd deploy actions/add-comment/add-comment.mts

# Deploy sources (triggers)
pd deploy sources/new-approval/new-approval.mts
pd deploy sources/approval-decided/approval-decided.mts
```

## Authentication

Configure your OKRunit connection in Pipedream with:

- **API Key**: Your OKRunit API key (starts with `gk_`)
- **API URL**: Your OKRunit instance URL (e.g., `https://app.okrunit.com`)

## Components

### Actions

| Action | Description |
|--------|-------------|
| **Create Approval** | Create a new approval request for human review |
| **Get Approval** | Fetch an approval request by ID |
| **List Approvals** | Search/list approval requests with filters |
| **Add Comment** | Add a comment to an approval request |

### Sources (Triggers)

| Source | Description |
|--------|-------------|
| **New Approval Request** | Emits when a new approval is created |
| **Approval Decided** | Emits when an approval is approved or rejected |

## CLI Usage Examples

```bash
# Test an action locally
pd action run okrunit-create-approval

# View source events
pd events okrunit-new-approval

# List deployed components
pd list components

# View logs
pd logs okrunit-new-approval
```

## Development

```bash
cd integrations/pipedream
npm install
npm run build
```

## Publishing

```bash
# Publish to Pipedream registry
pd publish
```
