# n8n-nodes-okrunit

[OKRunit](https://okrunit.com) community node for [n8n](https://n8n.io) — add human-in-the-loop approvals to any n8n workflow.

Pause your automation, wait for a human to approve or reject, then continue. Works with AI agents, deployment pipelines, financial transactions, content publishing, and any workflow that needs human oversight.

## Installation

### Community Node (recommended)

1. In n8n, go to **Settings > Community Nodes**
2. Enter `n8n-nodes-okrunit`
3. Click **Install**

### Manual Installation

```bash
cd ~/.n8n
npm install n8n-nodes-okrunit
```

Then restart n8n.

## Setup

### Option 1: OAuth2 (recommended)

1. In n8n, go to **Credentials > New Credential > OKRunit OAuth2 API**
2. The Base URL defaults to `https://okrunit.com`
3. Click **Connect** — you'll be redirected to OKRunit to authorize
4. Grant access and you're connected

### Option 2: API Key

1. In OKRunit, go to **Settings > Connections** and create a new connection
2. Copy the API key (starts with `gk_`, shown only once)
3. In n8n, create a new **OKRunit API** credential with your API key

## Nodes

### OKRunit

The main action node with these operations:

| Resource | Operation | Description |
|----------|-----------|-------------|
| Approval | **Create** | Submit a new approval request for human review |
| Approval | **Get** | Fetch an approval request by ID |
| Approval | **List** | Search/filter approval requests |
| Comment | **Add** | Add a comment to an approval request |
| Comment | **List** | List all comments on an approval request |

#### Create Approval

Required fields:
- **Title** — What needs approval (defaults to "Approval request from n8n" if blank)
- **Priority** — Low, Medium, High, or Critical

Optional fields (under Additional Fields):
- **Description** — Detailed context for the reviewer
- **Action Type** — Category like "deploy", "delete", "publish"
- **Callback URL** — Webhook URL to receive the decision
- **Metadata** — Arbitrary JSON data to attach
- **Expires At** — Auto-expire after this datetime
- **Required Approvals** — Number of approvals needed (1-10)
- **Context HTML** — Rich HTML displayed to approvers

### OKRunit Trigger

A polling trigger node that fires on approval events:

| Trigger | Description |
|---------|-------------|
| **New Approval Request** | Fires when a new approval is created |
| **Approval Decided** | Fires when an approval is approved or rejected |

Both triggers support optional status and priority filters.

## Example: Pause-and-wait pattern

1. **OKRunit node** (Create) — creates an approval request with a callback URL
2. **Wait node** — pauses the workflow
3. When someone approves/rejects in OKRunit, the callback resumes your workflow

Alternatively, use the **OKRunit Trigger** node in a separate workflow to react to decisions.

## Resources

- [OKRunit Documentation](https://okrunit.com/docs)
- [n8n Integration Guide](https://okrunit.com/docs/integrations/n8n)
- [API Reference](https://okrunit.com/docs/api)

## License

[MIT](LICENSE)
