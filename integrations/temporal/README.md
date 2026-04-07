# OKRunit Temporal Integration

Temporal workflows and activities for [OKRunit](https://okrunit.com) human-in-the-loop approval gates.

## Installation

```bash
pip install okrunit-temporal
```

## CLI Quickstart

```bash
# Start the Temporal dev server
temporal server start-dev

# In another terminal, start the OKRunit worker
python -m okrunit_temporal.worker

# Start an approval workflow
temporal workflow start \
  --type ApprovalGateWorkflow \
  --task-queue okrunit \
  --input '{"config": {"api_key": "gk_...", "api_url": "https://app.okrunit.com"}, "title": "Deploy v2.3.1 to production", "priority": "high"}'

# Check workflow status
temporal workflow describe --workflow-id <workflow-id>

# Query the current approval status
temporal workflow query \
  --type current_status \
  --workflow-id <workflow-id>

# List running approval workflows
temporal workflow list --query "WorkflowType='ApprovalGateWorkflow' AND ExecutionStatus='Running'"

# Terminate a stuck workflow
temporal workflow terminate --workflow-id <workflow-id> --reason "No longer needed"
```

## How It Works

1. **Start the worker** - processes approval gate workflows
2. **Start a workflow** - creates an OKRunit approval and polls for a decision
3. **Human decides** - approve or reject in the OKRunit dashboard
4. **Workflow completes** - returns the decision result

The workflow is fully durable. If the worker crashes, it resumes exactly where it left off when restarted.

## Components

### Activities

| Activity | Description |
|----------|-------------|
| `create_approval` | Create a new approval request (auto-sets `source: "temporal"` and idempotency key) |
| `get_approval` | Fetch an approval request by ID |
| `list_approvals` | Search/list approval requests with filters |
| `add_comment` | Add a comment to an approval request |

### Workflows

| Workflow | Description |
|----------|-------------|
| `ApprovalGateWorkflow` | Create approval + poll until decided or timed out |

### Queries

| Query | Description |
|-------|-------------|
| `current_status` | Returns current state: `initializing`, `creating`, `waiting:<id>`, `approved`, `rejected`, `timed_out` |

## Usage in Code

### Standalone Worker

```python
import asyncio
from okrunit_temporal.worker import run_worker

asyncio.run(run_worker(
    temporal_address="localhost:7233",
    task_queue="okrunit",
))
```

### Starting a Workflow from Code

```python
import asyncio
from temporalio.client import Client
from okrunit_temporal import ApprovalGateWorkflow, OKRunitConfig

async def main():
    client = await Client.connect("localhost:7233")

    config = OKRunitConfig(
        api_key="gk_...",
        api_url="https://app.okrunit.com",
    )

    result = await client.execute_workflow(
        ApprovalGateWorkflow.run,
        args=[config, "Deploy v2.3.1", "high", "New payment flow"],
        id="deploy-approval-v2.3.1",
        task_queue="okrunit",
    )

    print(f"Decision: {result['status']} by {result.get('decided_by_name')}")

asyncio.run(main())
```

### Embedding in Existing Workflows

```python
from temporalio import workflow
from okrunit_temporal.activities import create_approval, get_approval, OKRunitConfig

@workflow.defn
class DeployWorkflow:
    @workflow.run
    async def run(self):
        config = OKRunitConfig(api_key="gk_...", api_url="https://app.okrunit.com")

        # Gate on approval before deploying
        approval = await workflow.execute_activity(
            create_approval,
            args=[config, "Deploy to prod", "critical"],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Poll for decision...
        # Then proceed with deployment
```

## Canonical Spec Mapping

This table maps Temporal integration components to the canonical module types defined in [`integrations/shared/module-specs.md`](../shared/module-specs.md).

| Canonical Module    | Type    | Temporal Component        | Status          |
|---------------------|---------|---------------------------|-----------------|
| `requestApproval`   | Action  | `create_approval` activity | Implemented     |
| `getApproval`       | Search  | `get_approval` activity    | Implemented     |
| `listApprovals`     | Search  | `list_approvals` activity  | Implemented     |
| `addComment`        | Action  | `add_comment` activity     | Implemented     |
| `newApproval`       | Trigger | Not yet implemented        | Not implemented |
| `approvalDecided`   | Trigger | Not yet implemented        | Not implemented |

Note: The `newApproval` and `approvalDecided` triggers are not yet implemented for Temporal. The polling-based `ApprovalGateWorkflow` covers the approval-decided use case for workflow-internal gates, but standalone trigger activities that watch for new or decided approvals are not yet available.

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `temporal_address` | `localhost:7233` | Temporal server address |
| `task_queue` | `okrunit` | Task queue name |
| `namespace` | `default` | Temporal namespace |
| `timeout_seconds` | `3600` | Max wait time for a decision |
| `poll_interval_seconds` | `10` | How often to check for a decision |
