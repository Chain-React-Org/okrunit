# okrunit-crewai

CrewAI tool for [OKRunit](https://okrunit.com) human-in-the-loop approval gates. Use this when your CrewAI agents need human authorization before performing destructive or sensitive actions.

## Installation

```bash
pip install okrunit-crewai
```

## Quick Start

```python
from crewai import Agent, Task, Crew
from okrunit_crewai import OKRunitApprovalTool

# Initialize the tool (reads OKRUNIT_API_KEY from env if not provided)
approval_tool = OKRunitApprovalTool(api_key="gk_...")

# Create an agent with the approval tool
agent = Agent(
    role="DevOps Engineer",
    goal="Manage production deployments safely",
    backstory="You are a careful DevOps engineer who always gets approval before destructive actions.",
    tools=[approval_tool],
)

# Create a task
task = Task(
    description="Deploy the latest release to production. Get human approval first.",
    agent=agent,
    expected_output="Deployment status with approval details",
)

crew = Crew(agents=[agent], tasks=[task])
result = crew.kickoff()
```

## Direct Usage

```python
from okrunit_crewai import OKRunitApprovalTool

tool = OKRunitApprovalTool(
    api_key="gk_your_api_key",
    api_url="https://app.okrunit.com",  # optional
    timeout=1800,  # 30 minutes (default)
    poll_interval=5,  # seconds between status checks (default)
)

result = tool.run(
    title="Delete production database",
    description="Agent wants to drop the users table for cleanup",
    priority="critical",
    metadata='{"table": "users", "environment": "production"}',
)

# Result is a JSON string:
# {
#     "approval_id": "550e8400-...",
#     "status": "approved",
#     "title": "Delete production database",
#     "decided_by_name": "Jane Smith",
#     "decision_comment": "Approved after review",
#     "decided_at": "2026-03-24T10:30:00.000Z"
# }
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
| `metadata` | str (JSON) | no | JSON string of key-value data attached to the request |
| `callback_url` | str | no | Webhook URL to receive the decision |

## How It Works

1. The tool creates an approval request via the OKRunit API (`POST /api/v1/approvals`)
2. OKRunit notifies the configured reviewers (email, Slack, push notification)
3. The tool polls `GET /api/v1/approvals/{id}` every 5 seconds until a decision is made
4. Returns the decision result as a JSON string to the agent

The agent can then decide how to proceed based on the approval status.
