"""CrewAI Tool for requesting human approval via OKRunit.

Usage:
    from okrunit_crewai import OKRunitApprovalTool

    tool = OKRunitApprovalTool(
        api_key="gk_...",
        api_url="https://app.okrunit.com",
    )

    # Add to a CrewAI agent
    agent = Agent(
        role="DevOps Engineer",
        tools=[tool],
    )
"""

from __future__ import annotations

import json
import os
import random
import string
import time
from typing import Any, Type

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field


def _random_suffix(length: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


VALID_PRIORITIES = ("low", "medium", "high", "critical")
TERMINAL_STATUSES = ("approved", "rejected", "cancelled", "expired")


class ApprovalInput(BaseModel):
    """Input schema for the OKRunit approval tool."""

    title: str = Field(description="Short title describing the action that needs approval")
    description: str = Field(default="", description="Additional context for the reviewer")
    priority: str = Field(
        default="medium",
        description="Urgency level: low, medium, high, or critical",
    )
    metadata: str = Field(
        default="",
        description="Optional JSON string of key-value pairs for additional context",
    )
    callback_url: str = Field(
        default="",
        description="Optional webhook URL to receive the decision",
    )


class OKRunitApprovalTool(BaseTool):
    """CrewAI tool that requests human approval via OKRunit before proceeding.

    Use this tool when a CrewAI agent needs human authorization before performing
    a destructive or sensitive action. The tool creates an approval request,
    polls for a decision, and returns the result.

    The tool blocks until the approval is decided or the timeout is reached.
    """

    name: str = "okrunit_request_approval"
    description: str = (
        "Request human approval before performing a sensitive or destructive action. "
        "Returns the approval decision (approved/rejected) with details. "
        "Use this whenever the agent needs authorization to proceed with an action "
        "that could have significant consequences. "
        "Input must include 'title' (required). Optional: 'description', 'priority' "
        "(low/medium/high/critical), 'metadata' (JSON string), 'callback_url'."
    )
    args_schema: Type[BaseModel] = ApprovalInput

    api_key: str = ""
    api_url: str = "https://app.okrunit.com"
    poll_interval: float = 5.0
    timeout: float = 1800.0

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        if not self.api_key:
            self.api_key = os.environ.get("OKRUNIT_API_KEY", "")
        if self.api_url == "https://app.okrunit.com":
            self.api_url = os.environ.get("OKRUNIT_API_URL", self.api_url)
        if not self.api_key:
            raise ValueError(
                "OKRunit API key is required. Pass api_key or set OKRUNIT_API_KEY env var."
            )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _run(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        metadata: str = "",
        callback_url: str = "",
    ) -> str:
        """Create an approval request and poll until decided or timed out.

        Returns a JSON string with the approval result, suitable for CrewAI's
        string-based tool output pattern.
        """
        if not title:
            title = "Approval request from crewai"

        if priority not in VALID_PRIORITIES:
            return json.dumps({
                "status": "error",
                "error": f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}",
            })

        # Parse metadata JSON if provided
        parsed_metadata: dict[str, Any] = {}
        if metadata:
            try:
                parsed_metadata = json.loads(metadata)
            except json.JSONDecodeError:
                return json.dumps({
                    "status": "error",
                    "error": "metadata must be a valid JSON string",
                })

        idempotency_key = f"crewai-{int(time.time())}-{_random_suffix()}"

        body: dict[str, Any] = {
            "title": title,
            "priority": priority,
            "source": "crewai",
            "idempotency_key": idempotency_key,
        }
        if description:
            body["description"] = description
        if parsed_metadata:
            body["metadata"] = parsed_metadata
        if callback_url:
            body["callback_url"] = callback_url

        try:
            with httpx.Client(timeout=30.0) as client:
                # Create the approval request
                resp = client.post(
                    f"{self.api_url}/api/v1/approvals",
                    json=body,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                approval = resp.json()

                approval_id = approval["id"]
                deadline = time.time() + self.timeout

                # Poll until terminal status or timeout
                while time.time() < deadline:
                    status = approval.get("status", "pending")
                    if status in TERMINAL_STATUSES:
                        return json.dumps({
                            "approval_id": approval["id"],
                            "status": status,
                            "title": approval.get("title", ""),
                            "decided_by_name": approval.get("decided_by_name"),
                            "decision_comment": approval.get("decision_comment"),
                            "decided_at": approval.get("decided_at"),
                        })

                    time.sleep(self.poll_interval)

                    resp = client.get(
                        f"{self.api_url}/api/v1/approvals/{approval_id}",
                        headers=self._headers(),
                    )
                    resp.raise_for_status()
                    approval = resp.json()

                return json.dumps({
                    "approval_id": approval_id,
                    "status": "timeout",
                    "title": body["title"],
                    "error": f"Approval timed out after {self.timeout} seconds",
                })

        except httpx.HTTPStatusError as e:
            return json.dumps({
                "status": "error",
                "error": f"HTTP {e.response.status_code}: {e.response.text}",
            })
        except httpx.HTTPError as e:
            return json.dumps({
                "status": "error",
                "error": f"Request failed: {str(e)}",
            })
