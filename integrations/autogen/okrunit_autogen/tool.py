"""AutoGen function tool for requesting human approval via OKRunit.

Provides two ways to integrate with AutoGen:

1. OKRunitApprovalTool class — register with an agent via register_for_llm/register_for_execution
2. request_approval function — use directly or register manually as a callable

Usage with ConversableAgent:
    from autogen import ConversableAgent
    from okrunit_autogen import OKRunitApprovalTool

    tool = OKRunitApprovalTool(api_key="gk_...")

    assistant = ConversableAgent("assistant", llm_config=llm_config)
    user_proxy = ConversableAgent("user_proxy", code_execution_config=False)

    tool.register(assistant, user_proxy)

Usage as standalone function:
    from okrunit_autogen import request_approval

    result = request_approval(
        title="Delete production database",
        priority="critical",
        api_key="gk_...",
    )
"""

from __future__ import annotations

import asyncio
import os
import random
import string
import time
from typing import Annotated, Any

import httpx


def _random_suffix(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


VALID_PRIORITIES = ("low", "medium", "high", "critical")
TERMINAL_STATUSES = ("approved", "rejected", "cancelled", "expired")


def request_approval(
    title: Annotated[str, "Short title describing the action that needs approval"],
    description: Annotated[str, "Additional context for the reviewer"] = "",
    priority: Annotated[str, "Urgency level: low, medium, high, or critical"] = "medium",
    metadata: Annotated[dict[str, Any] | None, "Arbitrary key-value pairs for context"] = None,
    callback_url: Annotated[str, "Optional webhook URL to receive the decision"] = "",
    api_key: Annotated[str, "OKRunit API key (defaults to OKRUNIT_API_KEY env var)"] = "",
    api_url: Annotated[str, "OKRunit API URL"] = "https://app.okrunit.com",
    poll_interval: Annotated[float, "Seconds between status polls"] = 5.0,
    timeout: Annotated[float, "Max seconds to wait for a decision"] = 1800.0,
) -> dict[str, Any]:
    """Request human approval via OKRunit before performing a sensitive action.

    Creates an approval request in OKRunit, then polls until a human makes a
    decision or the timeout is reached. Returns a dict with the approval status
    and decision details.

    This function can be registered directly with AutoGen agents as a callable tool.
    """
    # Resolve config from env if not provided
    if not api_key:
        api_key = os.environ.get("OKRUNIT_API_KEY", "")
    if api_url == "https://app.okrunit.com":
        api_url = os.environ.get("OKRUNIT_API_URL", api_url)
    if not api_key:
        return {
            "status": "error",
            "error": "OKRunit API key is required. Pass api_key or set OKRUNIT_API_KEY env var.",
        }

    if not title:
        title = "Approval request from autogen"

    if priority not in VALID_PRIORITIES:
        return {
            "status": "error",
            "error": f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}",
        }

    idempotency_key = f"autogen-{int(time.time())}-{_random_suffix()}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body: dict[str, Any] = {
        "title": title,
        "priority": priority,
        "source": "autogen",
        "idempotency_key": idempotency_key,
    }
    if description:
        body["description"] = description
    if metadata:
        body["metadata"] = metadata
    if callback_url:
        body["callback_url"] = callback_url

    try:
        with httpx.Client(timeout=30.0) as client:
            # Create the approval request
            resp = client.post(
                f"{api_url}/api/v1/approvals",
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            approval = resp.json()

            approval_id = approval["id"]
            deadline = time.time() + timeout

            # Poll until terminal status or timeout
            while time.time() < deadline:
                status = approval.get("status", "pending")
                if status in TERMINAL_STATUSES:
                    return {
                        "approval_id": approval["id"],
                        "status": status,
                        "title": approval.get("title", ""),
                        "decided_by_name": approval.get("decided_by_name"),
                        "decision_comment": approval.get("decision_comment"),
                        "decided_at": approval.get("decided_at"),
                    }

                time.sleep(poll_interval)

                resp = client.get(
                    f"{api_url}/api/v1/approvals/{approval_id}",
                    headers=headers,
                )
                resp.raise_for_status()
                approval = resp.json()

            return {
                "approval_id": approval_id,
                "status": "timeout",
                "title": body["title"],
                "error": f"Approval timed out after {timeout} seconds",
            }

    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "error": f"HTTP {e.response.status_code}: {e.response.text}",
        }
    except httpx.HTTPError as e:
        return {
            "status": "error",
            "error": f"Request failed: {str(e)}",
        }


async def arequest_approval(
    title: Annotated[str, "Short title describing the action that needs approval"],
    description: Annotated[str, "Additional context for the reviewer"] = "",
    priority: Annotated[str, "Urgency level: low, medium, high, or critical"] = "medium",
    metadata: Annotated[dict[str, Any] | None, "Arbitrary key-value pairs for context"] = None,
    callback_url: Annotated[str, "Optional webhook URL to receive the decision"] = "",
    api_key: Annotated[str, "OKRunit API key (defaults to OKRUNIT_API_KEY env var)"] = "",
    api_url: Annotated[str, "OKRunit API URL"] = "https://app.okrunit.com",
    poll_interval: Annotated[float, "Seconds between status polls"] = 5.0,
    timeout: Annotated[float, "Max seconds to wait for a decision"] = 1800.0,
) -> dict[str, Any]:
    """Async version of request_approval."""
    if not api_key:
        api_key = os.environ.get("OKRUNIT_API_KEY", "")
    if api_url == "https://app.okrunit.com":
        api_url = os.environ.get("OKRUNIT_API_URL", api_url)
    if not api_key:
        return {
            "status": "error",
            "error": "OKRunit API key is required. Pass api_key or set OKRUNIT_API_KEY env var.",
        }

    if not title:
        title = "Approval request from autogen"

    if priority not in VALID_PRIORITIES:
        return {
            "status": "error",
            "error": f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}",
        }

    idempotency_key = f"autogen-{int(time.time())}-{_random_suffix()}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body: dict[str, Any] = {
        "title": title,
        "priority": priority,
        "source": "autogen",
        "idempotency_key": idempotency_key,
    }
    if description:
        body["description"] = description
    if metadata:
        body["metadata"] = metadata
    if callback_url:
        body["callback_url"] = callback_url

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{api_url}/api/v1/approvals",
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            approval = resp.json()

            approval_id = approval["id"]
            deadline = time.time() + timeout

            while time.time() < deadline:
                status = approval.get("status", "pending")
                if status in TERMINAL_STATUSES:
                    return {
                        "approval_id": approval["id"],
                        "status": status,
                        "title": approval.get("title", ""),
                        "decided_by_name": approval.get("decided_by_name"),
                        "decision_comment": approval.get("decision_comment"),
                        "decided_at": approval.get("decided_at"),
                    }

                await asyncio.sleep(poll_interval)

                resp = await client.get(
                    f"{api_url}/api/v1/approvals/{approval_id}",
                    headers=headers,
                )
                resp.raise_for_status()
                approval = resp.json()

            return {
                "approval_id": approval_id,
                "status": "timeout",
                "title": body["title"],
                "error": f"Approval timed out after {timeout} seconds",
            }

    except httpx.HTTPStatusError as e:
        return {
            "status": "error",
            "error": f"HTTP {e.response.status_code}: {e.response.text}",
        }
    except httpx.HTTPError as e:
        return {
            "status": "error",
            "error": f"Request failed: {str(e)}",
        }


class OKRunitApprovalTool:
    """Wrapper class for registering the approval function with AutoGen agents.

    Provides a convenient register() method that handles both
    register_for_llm and register_for_execution in one call.

    Usage:
        tool = OKRunitApprovalTool(api_key="gk_...")
        tool.register(assistant_agent, executor_agent)
    """

    def __init__(
        self,
        api_key: str = "",
        api_url: str = "https://app.okrunit.com",
        poll_interval: float = 5.0,
        timeout: float = 1800.0,
    ) -> None:
        self.api_key = api_key or os.environ.get("OKRUNIT_API_KEY", "")
        env_url = os.environ.get("OKRUNIT_API_URL", "https://app.okrunit.com")
        self.api_url = api_url if api_url != "https://app.okrunit.com" else env_url
        self.poll_interval = poll_interval
        self.timeout = timeout

        if not self.api_key:
            raise ValueError(
                "OKRunit API key is required. Pass api_key or set OKRUNIT_API_KEY env var."
            )

    def _make_fn(self) -> callable:
        """Create a bound function with pre-configured API settings."""
        api_key = self.api_key
        api_url = self.api_url
        poll_interval = self.poll_interval
        timeout = self.timeout

        def okrunit_request_approval(
            title: Annotated[str, "Short title describing the action that needs approval"],
            description: Annotated[str, "Additional context for the reviewer"] = "",
            priority: Annotated[str, "Urgency: low, medium, high, or critical"] = "medium",
            metadata: Annotated[dict[str, Any] | None, "Key-value pairs for context"] = None,
            callback_url: Annotated[str, "Webhook URL to receive the decision"] = "",
        ) -> dict[str, Any]:
            """Request human approval via OKRunit before performing a sensitive action.

            Creates an approval request, waits for a human decision, and returns
            the result. Use this before any destructive or high-impact action.
            """
            return request_approval(
                title=title,
                description=description,
                priority=priority,
                metadata=metadata,
                callback_url=callback_url,
                api_key=api_key,
                api_url=api_url,
                poll_interval=poll_interval,
                timeout=timeout,
            )

        return okrunit_request_approval

    def register(self, assistant: Any, executor: Any) -> None:
        """Register the approval tool with an AutoGen assistant and executor agent pair.

        Args:
            assistant: The ConversableAgent that will decide when to call the tool (LLM agent).
            executor: The ConversableAgent that will execute the tool call.
        """
        fn = self._make_fn()

        assistant.register_for_llm(
            name="okrunit_request_approval",
            description=(
                "Request human approval before performing a sensitive or destructive action. "
                "Returns the approval decision (approved/rejected) with details."
            ),
        )(fn)

        executor.register_for_execution(
            name="okrunit_request_approval",
        )(fn)
