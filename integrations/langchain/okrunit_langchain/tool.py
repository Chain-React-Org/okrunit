"""LangChain Tool for requesting human approval via OKRunit.

Usage:
    from okrunit_langchain import OKRunitApprovalTool

    tool = OKRunitApprovalTool(
        api_key="gk_...",
        api_url="https://app.okrunit.com",
    )

    # Use in a LangChain agent
    agent = create_react_agent(llm, [tool])

    # Or call directly
    result = tool.invoke({
        "title": "Delete production database",
        "description": "Agent wants to drop the users table",
        "priority": "critical",
    })
"""

from __future__ import annotations

import asyncio
import os
import random
import string
import time
from typing import Any, Type

import httpx
from langchain_core.callbacks import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain_core.tools import BaseTool
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
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary key-value pairs for additional context",
    )
    callback_url: str = Field(
        default="",
        description="Optional webhook URL to receive the decision",
    )


class OKRunitApprovalTool(BaseTool):
    """LangChain tool that requests human approval via OKRunit before proceeding.

    Use this tool when an AI agent needs human authorization before performing
    a destructive or sensitive action. The tool creates an approval request,
    polls for a decision, and returns the result.

    The tool blocks until the approval is decided or the timeout is reached.
    """

    name: str = "okrunit_request_approval"
    description: str = (
        "Request human approval before performing a sensitive or destructive action. "
        "Returns the approval decision (approved/rejected) with details. "
        "Use this whenever the agent needs authorization to proceed with an action "
        "that could have significant consequences."
    )
    args_schema: Type[BaseModel] = ApprovalInput

    api_key: str = Field(default="")
    api_url: str = Field(default="https://app.okrunit.com")
    poll_interval: float = Field(default=5.0, description="Seconds between status polls")
    timeout: float = Field(default=1800.0, description="Max seconds to wait for a decision (default 30 min)")

    def model_post_init(self, __context: Any) -> None:
        """Resolve API key and URL from environment if not provided."""
        super().model_post_init(__context)
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

    def _build_body(
        self,
        title: str,
        description: str,
        priority: str,
        metadata: dict[str, Any],
        callback_url: str,
    ) -> dict[str, Any]:
        if not title:
            title = "Approval request from langchain"

        if priority not in VALID_PRIORITIES:
            raise ValueError(
                f"Invalid priority '{priority}'. Must be one of: {', '.join(VALID_PRIORITIES)}"
            )

        idempotency_key = f"langchain-{int(time.time())}-{_random_suffix()}"

        body: dict[str, Any] = {
            "title": title,
            "priority": priority,
            "source": "langchain",
            "idempotency_key": idempotency_key,
        }
        if description:
            body["description"] = description
        if metadata:
            body["metadata"] = metadata
        if callback_url:
            body["callback_url"] = callback_url

        return body

    def _run(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        metadata: dict[str, Any] | None = None,
        callback_url: str = "",
        run_manager: CallbackManagerForToolRun | None = None,
    ) -> dict[str, Any]:
        """Create an approval request and poll until decided or timed out."""
        body = self._build_body(title, description, priority, metadata or {}, callback_url)

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
                    return {
                        "approval_id": approval["id"],
                        "status": status,
                        "title": approval.get("title", ""),
                        "decided_by_name": approval.get("decided_by_name"),
                        "decision_comment": approval.get("decision_comment"),
                        "decided_at": approval.get("decided_at"),
                    }

                time.sleep(self.poll_interval)

                resp = client.get(
                    f"{self.api_url}/api/v1/approvals/{approval_id}",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                approval = resp.json()

            return {
                "approval_id": approval_id,
                "status": "timeout",
                "title": body["title"],
                "error": f"Approval timed out after {self.timeout} seconds",
            }

    async def _arun(
        self,
        title: str,
        description: str = "",
        priority: str = "medium",
        metadata: dict[str, Any] | None = None,
        callback_url: str = "",
        run_manager: AsyncCallbackManagerForToolRun | None = None,
    ) -> dict[str, Any]:
        """Async version: create an approval request and poll until decided or timed out."""
        body = self._build_body(title, description, priority, metadata or {}, callback_url)

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Create the approval request
            resp = await client.post(
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
                    return {
                        "approval_id": approval["id"],
                        "status": status,
                        "title": approval.get("title", ""),
                        "decided_by_name": approval.get("decided_by_name"),
                        "decision_comment": approval.get("decision_comment"),
                        "decided_at": approval.get("decided_at"),
                    }

                await asyncio.sleep(self.poll_interval)

                resp = await client.get(
                    f"{self.api_url}/api/v1/approvals/{approval_id}",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                approval = resp.json()

            return {
                "approval_id": approval_id,
                "status": "timeout",
                "title": body["title"],
                "error": f"Approval timed out after {self.timeout} seconds",
            }
