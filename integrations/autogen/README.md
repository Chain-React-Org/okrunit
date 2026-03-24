# okrunit-autogen

AutoGen function tool for [OKRunit](https://okrunit.com) human-in-the-loop approval gates. Use this when your AutoGen agents need human authorization before performing destructive or sensitive actions.

## Installation

```bash
pip install okrunit-autogen
```

## Quick Start

```python
from autogen import ConversableAgent
from okrunit_autogen import OKRunitApprovalTool

# Initialize the tool (reads OKRUNIT_API_KEY from env if not provided)
tool = OKRunitApprovalTool(api_key="gk_...")

# Create agents
assistant = ConversableAgent(
    "assistant",
    llm_config={"config_list": [{"model": "gpt-4", "api_key": "..."}]},
    system_message="You are a helpful assistant. Use okrunit_request_approval before any destructive action.",
)

executor = ConversableAgent(
    "executor",
    human_input_mode="NEVER",
    code_execution_config=False,
)

# Register the tool with both agents
tool.register(assistant, executor)

# Start a conversation
executor.initiate_chat(
    assistant,
    message="Delete all expired user accounts from the database.",
)
```

## Standalone Function

```python
from okrunit_autogen import request_approval

# Call directly without AutoGen agent setup
result = request_approval(
    title="Delete production database",
    description="Agent wants to drop the users table for cleanup",
    priority="critical",
    metadata={"table": "users", "environment": "production"},
    api_key="gk_your_api_key",
)

# Result format:
# {
#     "approval_id": "550e8400-...",
#     "status": "approved",       # or "rejected", "cancelled", "expired", "timeout", "error"
#     "title": "Delete production database",
#     "decided_by_name": "Jane Smith",
#     "decision_comment": "Approved after review",
#     "decided_at": "2026-03-24T10:30:00.000Z"
# }
```

## Async Support

```python
from okrunit_autogen.tool import arequest_approval

result = await arequest_approval(
    title="Deploy v2.0 to production",
    priority="high",
)
```

## Configuration

| Parameter | Env Variable | Default | Description |
|-----------|-------------|---------|-------------|
| `api_key` | `OKRUNIT_API_KEY` | (required) | Your OKRunit API key (`gk_` prefix) |
| `api_url` | `OKRUNIT_API_URL` | `https://app.okrunit.com` | OKRunit API base URL |
| `timeout` | - | `1800` (30 min) | Max seconds to wait for a decision |
| `poll_interval` | - | `5` | Seconds between polling requests |

## Input Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | str | yes | Short title describing the action |
| `description` | str | no | Additional context for the reviewer |
| `priority` | str | no | `low`, `medium` (default), `high`, or `critical` |
| `metadata` | dict | no | Arbitrary key-value data attached to the request |
| `callback_url` | str | no | Webhook URL to receive the decision |

## How It Works

1. The tool creates an approval request via the OKRunit API (`POST /api/v1/approvals`)
2. OKRunit notifies the configured reviewers (email, Slack, push notification)
3. The tool polls `GET /api/v1/approvals/{id}` every 5 seconds until a decision is made
4. Returns the decision result as a dict to the agent

The agent can then decide how to proceed based on the approval status.
