# okrunit-langchain

LangChain/LangGraph tool for [OKRunit](https://okrunit.com) human-in-the-loop approval gates. Use this when your AI agent needs human authorization before performing destructive or sensitive actions.

## Installation

```bash
pip install okrunit-langchain
```

## Quick Start

```python
from okrunit_langchain import OKRunitApprovalTool

# Initialize the tool (reads OKRUNIT_API_KEY from env if not provided)
tool = OKRunitApprovalTool(api_key="gk_...")

# Use in a LangChain agent
from langchain.agents import create_react_agent
agent = create_react_agent(llm, [tool])
```

## Direct Usage

```python
from okrunit_langchain import OKRunitApprovalTool

tool = OKRunitApprovalTool(
    api_key="gk_your_api_key",
    api_url="https://app.okrunit.com",  # optional, defaults to this
    timeout=1800,  # 30 minutes (default)
    poll_interval=5,  # seconds between status checks (default)
)

# Sync call
result = tool.invoke({
    "title": "Delete production database",
    "description": "Agent wants to drop the users table for cleanup",
    "priority": "critical",
    "metadata": {"table": "users", "environment": "production"},
})

# Async call
result = await tool.ainvoke({
    "title": "Deploy v2.0 to production",
    "priority": "high",
})

# Result format:
# {
#     "approval_id": "550e8400-...",
#     "status": "approved",       # or "rejected", "cancelled", "expired", "timeout"
#     "title": "Delete production database",
#     "decided_by_name": "Jane Smith",
#     "decision_comment": "Approved after review",
#     "decided_at": "2026-03-24T10:30:00.000Z"
# }
```

## With LangGraph

```python
from langgraph.graph import StateGraph
from okrunit_langchain import OKRunitApprovalTool

approval_tool = OKRunitApprovalTool()

def check_approval(state):
    result = approval_tool.invoke({
        "title": f"Approve: {state['action']}",
        "description": state.get("reason", ""),
        "priority": "high",
    })
    if result["status"] != "approved":
        return {"blocked": True, "reason": result.get("decision_comment", "Rejected")}
    return {"blocked": False}

graph = StateGraph(...)
graph.add_node("approval_gate", check_approval)
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
4. Returns the decision result to the agent

The agent can then decide how to proceed based on the approval status.
