# Integration Marketplace Listings

## Zapier App Directory

Submit at: https://developer.zapier.com/

**App Name**: OKrunit
**Tagline**: Human approval gateway for automated workflows
**Category**: Developer Tools / Productivity

**Description**:
```
OKrunit adds a human approval step to your Zaps. Before your automation deletes records, sends emails, deploys code, or performs any sensitive action, OKrunit pauses execution and asks a human to approve or reject.

How it works:
1. Add the OKrunit "Request Approval" step to your Zap
2. Configure what information the approver should see
3. When the Zap triggers, it pauses at the OKrunit step
4. Your team gets notified via Slack, email, Discord, Teams, or Telegram
5. A human reviews and approves or rejects
6. Your Zap continues or stops based on the decision

Features:
- Multi-step approvals (require multiple people to approve)
- Sequential approval chains (manager, then VP, then CTO)
- Priority levels (low, medium, high, critical)
- SLA tracking with automatic escalation
- Full audit trail of every decision
- Notification routing per source

Use cases:
- Bulk delete/archive operations
- Sending emails or notifications to large lists
- Production deployments
- CRM data modifications
- Financial transactions
- Any action you can't easily undo

Free tier: 100 requests/month, 2 connections. No credit card required.
```

---

## Make (Integromat) Marketplace

**App Name**: OKrunit
**Category**: Tools

**Short Description**:
```
Add human approval to any Make scenario. Pause execution before destructive actions and wait for a human decision.
```

**Full Description**:
```
OKrunit is a human-in-the-loop approval gateway. Add it to your Make scenario before any sensitive action, and it will pause execution until a designated human approves or rejects.

Modules:
- Request Approval: Creates an approval request and waits for a human decision
- Check Status: Checks the current status of an existing approval request

Configure notification channels (Slack, email, Discord, Teams, Telegram), approval rules (multi-step, sequential), and escalation policies from the OKrunit dashboard.

Free tier available.
```

---

## n8n Community Nodes

Your node is already published on npm as `n8n-nodes-okrunit`. To increase visibility:

### n8n Community Forum post

Post at: https://community.n8n.io/ in the "Share your workflow" or "Community Nodes" category.

**Title**: `[Community Node] OKrunit - Human approval step for workflows`

**Body**:
```
Hey everyone! I built a community node that adds a human approval step to n8n workflows.

**What it does**: When your workflow reaches the OKrunit node, it creates an approval request and pauses. A human reviews the request (from the OKrunit dashboard, Slack, email, etc.) and approves or rejects. The workflow then continues with the decision.

**Install**: Settings > Community Nodes > Install > `n8n-nodes-okrunit`

**Use cases**:
- Add a sanity check before bulk database operations
- Require manager approval before sending customer communications
- Gate production deployments behind a human decision
- Any "are you sure?" moment in your workflow

**Features**:
- Multiple approvers (2 of 3 must approve)
- Sequential chains (first manager, then CTO)
- Priority levels with SLA tracking
- Notification routing to Slack, email, Discord, Teams, Telegram
- Full audit trail

**Free tier**: 100 requests/month, 2 connections.

Docs: https://okrunit.com/docs/integrations

Happy to answer questions or help with setup!
```

---

## GitHub Topics

Add these topics to your n8n community node GitHub repo:
```
n8n, n8n-community-node, approval, human-in-the-loop, automation, workflow, zapier, make, integromat
```
