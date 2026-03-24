# OKRunit -- Microsoft Power Automate Custom Connector

A custom connector for Microsoft Power Automate (formerly Microsoft Flow) that lets you create, monitor, and act on OKRunit approval requests directly from your flows.

## Overview

This connector enables Power Automate flows to:

- **Create** approval requests when automated actions need human sign-off
- **Check** the status of existing approvals
- **Approve** or **Reject** pending requests
- **Add comments** to approval requests

## Setup

### 1. Import the Custom Connector

1. Go to [Power Automate](https://make.powerautomate.com)
2. Navigate to **Data** > **Custom connectors**
3. Click **+ New custom connector** > **Import an OpenAPI file**
4. Upload `apiDefinition.swagger.json`
5. Click **Continue**

### 2. Configure Connector Properties

The connector properties are pre-configured in `apiProperties.json`. If importing manually:

- **Icon brand color**: `#2563EB`
- **Host**: `app.okrunit.com` (or your custom instance URL)
- **Base URL**: `/api/v1`
- **Authentication**: API Key (sent as `Authorization: Bearer <key>` header)

### 3. Create a Connection

1. In your flow, add an OKRunit action
2. When prompted, enter your API key (starts with `gk_`)
3. Optionally enter your custom OKRunit instance URL

## Available Actions

### Create Approval Request

Creates a new approval request and notifies reviewers.

| Field | Required | Description |
|-------|----------|-------------|
| Title | Yes | Short title for the approval |
| Description | No | Additional context for reviewers |
| Priority | No | `low`, `medium`, `high`, or `critical` (default: `medium`) |
| Action Type | No | Category (e.g., `deploy`, `delete`, `transfer`) |
| Callback URL | No | Webhook URL to receive the decision |
| Metadata | No | JSON key-value pairs for context |
| Expires At | No | Auto-expire date/time |
| Required Approvals | No | Number of approvals needed (default: 1) |

The `source` field is automatically set to `power-automate`.

### Get Approval Request

Fetch details of a specific approval by ID.

| Field | Required | Description |
|-------|----------|-------------|
| Approval ID | Yes | The UUID of the approval |

### List Approval Requests

Search and filter approval requests.

| Field | Required | Description |
|-------|----------|-------------|
| Status | No | Filter: `pending`, `approved`, `rejected`, `cancelled`, `expired` |
| Priority | No | Filter: `low`, `medium`, `high`, `critical` |
| Search | No | Full-text search on title and description |
| Limit | No | Max results (default: 25, max: 100) |

### Approve Request

Approve a pending approval request.

| Field | Required | Description |
|-------|----------|-------------|
| Approval ID | Yes | The UUID of the approval |
| Comment | No | Explanation for the approval |

### Reject Request

Reject a pending approval request.

| Field | Required | Description |
|-------|----------|-------------|
| Approval ID | Yes | The UUID of the approval |
| Comment | No | Explanation for the rejection |

### Add Comment

Add a comment to an approval request.

| Field | Required | Description |
|-------|----------|-------------|
| Approval ID | Yes | The UUID of the approval |
| Comment | Yes | Comment text (max 5000 characters) |

## Example Flows

### Gate a SharePoint deletion behind approval

1. **Trigger**: When a file is deleted in SharePoint
2. **Action**: OKRunit > Create Approval Request
   - Title: `Delete file: {FileName}`
   - Priority: `high`
   - Description: `User {UserName} wants to delete {FilePath}`
3. **Action**: OKRunit > Get Approval Request (poll in a loop or use callback)
4. **Condition**: If status = approved
   - **Yes**: Proceed with deletion
   - **No**: Restore file and notify user

### Wait for approval with a Do Until loop

```
1. Create Approval Request -> store approval_id
2. Do Until (status != "pending")
   a. Delay: 30 seconds
   b. Get Approval Request (approval_id)
   c. Set variable: status = response.status
3. Condition: status = "approved"
   - Yes: proceed
   - No: abort and notify
```

### Use callback URL for instant notification

1. Create a flow with an HTTP trigger (this gives you a callback URL)
2. In your main flow, create an approval request with the HTTP trigger URL as the callback
3. When the approval is decided, OKRunit POSTs the decision to your HTTP trigger flow

## Files

| File | Description |
|------|-------------|
| `apiDefinition.swagger.json` | OpenAPI 2.0 spec for the custom connector |
| `apiProperties.json` | Connector properties (branding, auth config, policies) |

## Authentication

The connector uses API Key authentication. Your OKRunit API key (starting with `gk_`) is sent as a Bearer token in the Authorization header.

To get an API key:
1. Log in to OKRunit
2. Go to **Settings** > **API Keys**
3. Click **Create API Key**
4. Copy the key (it starts with `gk_`)

## Troubleshooting

**401 Unauthorized**: Verify your API key is correct and starts with `gk_`.

**404 Not Found**: Check that the approval ID is a valid UUID and belongs to your organization.

**400 Bad Request**: Ensure required fields are provided and values are valid (e.g., priority must be one of: low, medium, high, critical).

**409 Conflict**: The idempotency key has already been used. Use a unique key for each request.
