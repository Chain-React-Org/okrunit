# OKRunit Dagster Integration

Dagster resource, ops, and sensors for [OKRunit](https://okrunit.com) human-in-the-loop approval gates.

## Installation

```bash
pip install dagster-okrunit
```

## CLI Quickstart

```bash
# Start the Dagster dev server with OKRunit configured
dagster dev -m dagster_okrunit

# Launch the example approval gate job
dagster job launch -j deploy_with_approval \
  --config '{"ops": {"approval_gate_op": {"config": {"title": "Deploy v2.3.1", "priority": "high"}}}}'

# Start the approval decision sensor
dagster sensor start approval_decided_sensor

# Check sensor status
dagster sensor list

# View job runs
dagster run list

# Tail logs for a run
dagster run logs <run-id>
```

## Components

### Resource

| Resource | Description |
|----------|-------------|
| `OKRunitResource` | Configurable resource for OKRunit API calls |

### Ops

| Op | Canonical Spec Module | Type | Description |
|----|----------------------|------|-------------|
| `create_approval_op` | requestApproval | Action | Create a new approval request (auto-sets `source: "dagster"` and idempotency key) |
| `get_approval_op` | getApproval | Search | Fetch an approval request by ID |
| `list_approvals_op` | listApprovals | Search | Search and list approval requests with filters |
| `approval_gate_op` | requestApproval | Action | Create approval + poll until decided (blocks the op) |
| `add_comment_op` | addComment | Action | Add a comment to an approval request |

### Sensors

| Sensor | Description |
|--------|-------------|
| `approval_decided_sensor` | Triggers runs when approvals are approved or rejected |

### Jobs

| Job | Description |
|-----|-------------|
| `deploy_with_approval` | Example job gating on human approval |

## Usage in Definitions

```python
from dagster import Definitions
from dagster_okrunit import (
    OKRunitResource,
    approval_gate_op,
    approval_decided_sensor,
    deploy_with_approval,
)

defs = Definitions(
    resources={
        "okrunit": OKRunitResource(
            api_key="gk_...",
            api_url="https://app.okrunit.com",
        ),
    },
    jobs=[deploy_with_approval],
    sensors=[approval_decided_sensor],
)
```

## Custom Jobs

```python
from dagster import job, op
from dagster_okrunit import approval_gate_op, OKRunitResource

@op
def run_deployment(context, approval: dict):
    context.log.info(f"Deploying! Approved by {approval.get('decided_by_name')}")

@job(resource_defs={"okrunit": OKRunitResource(api_key="gk_...", api_url="https://app.okrunit.com")})
def my_deploy_pipeline():
    approval = approval_gate_op()
    run_deployment(approval)
```

## Integration Details

- **Source:** All approval creation ops automatically set `source` to `"dagster"`.
- **Idempotency key format:** `dagster-{timestamp}-{random}`, auto-generated on every `create_approval` call.
- **Default title:** If no title is provided, defaults to `"Approval request from dagster"`.
- **Priority validation:** Must be one of `low`, `medium`, `high`, or `critical`.
- **newApproval trigger:** Not yet implemented as a Dagster sensor. The `approval_decided_sensor` covers the `approvalDecided` trigger only.

## Environment Variables

Instead of hardcoding the API key, use Dagster's env var support:

```python
from dagster import EnvVar

defs = Definitions(
    resources={
        "okrunit": OKRunitResource(
            api_key=EnvVar("OKRUNIT_API_KEY"),
            api_url=EnvVar("OKRUNIT_API_URL"),
        ),
    },
)
```

```bash
export OKRUNIT_API_KEY="gk_..."
export OKRUNIT_API_URL="https://app.okrunit.com"
dagster dev
```
