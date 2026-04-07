# OKRunit Make.com Integration

Native Make.com custom app for the [OKRunit](https://www.okrunit.com) human-in-the-loop approval gateway.

## Features

### Triggers

- **New Approval Request** - Fires when a new approval request is created. Supports filtering by status and priority.
- **Approval Decided** - Fires when an approval request is approved or rejected. Supports filtering by decision type and priority.

### Actions

- **Request Approval** - Create an approval and optionally pause your workflow until a human decides. Pair with a Make webhook to build a pause-and-wait pattern.
- **Get Approval Request** - Fetch a single approval by its UUID.
- **Add Comment** - Add a comment to an existing approval request.

### Searches

- **List Approvals** - Search approval requests with status, priority, and full-text filters.

## Setup

### Prerequisites

- A [OKRunit](https://www.okrunit.com) account
- A [Make Developer](https://www.make.com/en/developer) account

### Installation

1. Go to the [Make Developer Portal](https://www.make.com/en/developer)
2. Create a new app or import from these JSON files
3. Import each file into the appropriate section:
   - `base.json` → App settings
   - `connections/oauth2.json` → Connections
   - `rpcs/check_auth.json` → RPCs
   - `modules/*.json` → Modules

### Configuration

Users just click **Connect** and authorize via OAuth2. No API keys or URLs to enter.

## Pause-and-Wait Pattern

Make.com doesn't have a native "send and wait" like Zapier, but you can achieve the same result:

1. **Scenario A** - Use the **Request Approval** module with a Make webhook URL as the callback
2. **Scenario B** - Use a **Custom Webhook** trigger that receives the decision from OKRunit
3. When a human approves or rejects in the OKRunit dashboard, OKRunit POSTs the decision to the webhook, triggering Scenario B

This gives you the same human-in-the-loop workflow as the Zapier "Send & Wait" pattern.

## Project Structure

```
make/
├── base.json                    # App metadata and default headers
├── connections/
│   └── oauth2.json              # OAuth2 connection with PKCE
├── rpcs/
│   └── check_auth.json          # Remote procedure call for auth validation
├── modules/
│   ├── request_approval.json    # Request Approval (pause & wait via webhook)
│   ├── get_approval.json        # Get Approval by ID
│   ├── list_approvals.json      # List/Search Approvals
│   ├── add_comment.json         # Add Comment
│   ├── new_approval.json        # Trigger: New Approval Request
│   └── approval_decided.json    # Trigger: Approval Decided
└── README.md
```

## API Endpoints Used

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create / Request Approval | POST | `/api/v1/approvals` |
| Get Approval | GET | `/api/v1/approvals/:id` |
| List Approvals | GET | `/api/v1/approvals` |
| Add Comment | POST | `/api/v1/approvals/:id/comments` |
| Auth Test | GET | `/api/v1/approvals?page_size=1` |

## Authentication

The integration uses OAuth 2.0 with PKCE. Users click "Connect" in Make, authorize in the OKRunit dashboard, and tokens are managed automatically. Sensitive headers are sanitized in Make's request logs.

## Testing

1. Import the JSON files into the Make Developer Portal
2. Create a connection (click Connect, authorize via OAuth)
3. Test each module in a scenario:
   - Create an approval, verify it appears in the OKRunit dashboard
   - Get the approval by ID, verify all fields
   - List approvals with filters, verify results
   - Add a comment, verify it appears
   - Set up the New Approval trigger, create a request, verify it fires
   - Set up the Approval Decided trigger, approve/reject via dashboard, verify it fires
   - Test the pause-and-wait pattern with Request Approval + webhook callback
