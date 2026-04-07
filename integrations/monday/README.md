# OKRunit monday.com Integration

Native monday.com app for the [OKRunit](https://okrunit.com) human-in-the-loop approval gateway.

## Features

### Triggers

- **New Approval Request** - Fires when a new approval request is created. Supports filtering by status and priority.
- **Approval Decided** - Fires when an approval request is approved or rejected. Supports filtering by decision type and priority.

### Actions

- **Request Approval** - Create an approval and optionally pause your workflow until a human decides. Pair with a monday.com webhook to build a pause-and-wait pattern.
- **Get Approval Request** - Fetch a single approval by its UUID.
- **Add Comment** - Add a comment to an existing approval request.

### Searches

- **List Approvals** - Search approval requests with status, priority, and full-text filters.

## Setup

### Prerequisites

- A [OKRunit](https://okrunit.com) account
- A [monday.com](https://monday.com) account with admin access

### Installation

1. Go to your monday.com Apps Marketplace
2. Search for "OKRunit" or install from the app listing
3. Click **Install** and authorize via OAuth2

### Configuration

Users just click **Connect** and authorize via OAuth2. No API keys or URLs to enter.

## Pause-and-Wait Pattern

monday.com doesn't have a native "send and wait" like Zapier, but you can achieve the same result:

1. **Automation A** - Use the **Request Approval** action with a monday.com webhook URL as the callback
2. **Automation B** - Use a **Custom Webhook** trigger that receives the decision from OKRunit
3. When a human approves or rejects in the OKRunit dashboard, OKRunit POSTs the decision to the webhook, triggering Automation B

## Use Cases

- **Board item approvals** - Require human approval before moving items between groups or changing status
- **Budget approvals** - Gate financial decisions with a human approval step
- **Content publishing** - Require editorial approval before publishing content managed in monday.com
- **Vendor onboarding** - Add approval gates to vendor/client onboarding workflows
