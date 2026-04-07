"""OKRunit Dagster ops for human-in-the-loop approval gates."""

import time
from typing import Optional

from dagster import op, Out, OpExecutionContext, Failure, Config


_VALID_PRIORITIES = ("low", "medium", "high", "critical")


def _validate_priority(priority: str) -> None:
    if priority not in _VALID_PRIORITIES:
        raise Failure(
            description=f"Invalid priority '{priority}'. Must be one of: {', '.join(_VALID_PRIORITIES)}"
        )


class ApprovalConfig(Config):
    title: str = ""
    priority: str = "medium"
    description: str = ""


class ApprovalGateConfig(Config):
    title: str = ""
    priority: str = "medium"
    description: str = ""
    timeout_seconds: int = 3600
    poll_interval: int = 10


class CommentConfig(Config):
    approval_id: str
    body: str


class ListApprovalsConfig(Config):
    status: str = ""
    priority: str = ""
    search: str = ""
    limit: int = 25


@op(required_resource_keys={"okrunit"}, out=Out(dict))
def create_approval_op(context: OpExecutionContext, config: ApprovalConfig) -> dict:
    """Create a new OKRunit approval request."""
    _validate_priority(config.priority)
    result = context.resources.okrunit.create_approval(
        title=config.title or None,
        priority=config.priority,
        description=config.description or None,
    )
    context.log.info(f"Created approval {result['id']}: {result['title']}")
    return result


@op(required_resource_keys={"okrunit"}, out=Out(dict))
def get_approval_op(context: OpExecutionContext, approval_id: str) -> dict:
    """Fetch an approval request by ID."""
    return context.resources.okrunit.get_approval(approval_id)


@op(required_resource_keys={"okrunit"}, out=Out(dict))
def list_approvals_op(context: OpExecutionContext, config: ListApprovalsConfig) -> dict:
    """Search and list approval requests with filters."""
    result = context.resources.okrunit.list_approvals(
        status=config.status or None,
        priority=config.priority or None,
        search=config.search or None,
        limit=config.limit,
    )
    context.log.info(f"Listed approvals: {len(result.get('data', []))} results")
    return result


@op(required_resource_keys={"okrunit"}, out=Out(dict))
def approval_gate_op(context: OpExecutionContext, config: ApprovalGateConfig) -> dict:
    """Create an approval and poll until a human decides.

    Raises Failure if rejected or timed out.
    """
    _validate_priority(config.priority)
    approval = context.resources.okrunit.create_approval(
        title=config.title or None,
        priority=config.priority,
        description=config.description or None,
    )
    approval_id = approval["id"]
    context.log.info(
        f"Created approval {approval_id}, waiting for decision "
        f"(timeout: {config.timeout_seconds}s)..."
    )

    deadline = time.time() + config.timeout_seconds

    while time.time() < deadline:
        result = context.resources.okrunit.get_approval(approval_id)

        if result["status"] in ("approved", "rejected"):
            decided_by = result.get("decided_by_name", "unknown")
            comment = result.get("decision_comment", "")
            context.log.info(
                f"Approval {approval_id}: {result['status']} by {decided_by}"
                + (f": {comment}" if comment else "")
            )

            if result["status"] == "rejected":
                raise Failure(
                    description=(
                        f"Rejected by {decided_by}"
                        + (f": {comment}" if comment else "")
                    )
                )

            return result

        elapsed = int(time.time() - (deadline - config.timeout_seconds))
        context.log.info(f"Still waiting... ({elapsed}s elapsed)")
        time.sleep(config.poll_interval)

    raise Failure(
        description=f"Approval {approval_id} timed out after {config.timeout_seconds}s"
    )


@op(required_resource_keys={"okrunit"}, out=Out(dict))
def add_comment_op(context: OpExecutionContext, config: CommentConfig) -> dict:
    """Add a comment to an approval request."""
    result = context.resources.okrunit.add_comment(config.approval_id, config.body)
    context.log.info(f"Added comment to approval {config.approval_id}")
    return result
