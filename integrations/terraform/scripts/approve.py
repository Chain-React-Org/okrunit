#!/usr/bin/env python3
"""
OKRunit Approval Gate for Terraform (Python)

Creates an approval request and polls until a decision is made.
Cross-platform alternative to approve.sh.

Environment variables:
    OKRUNIT_API_KEY  (required) — API key starting with gk_
    OKRUNIT_API_URL  (optional) — Base URL, defaults to https://app.okrunit.com

Usage:
    python approve.py --title "Destroy production DB" --priority critical
    python approve.py --title "Apply changes" --description "Adding 3 EC2 instances" --metadata '{"workspace":"prod"}'
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request


def api_request(
    method: str,
    url: str,
    api_key: str,
    body: dict | None = None,
) -> dict:
    """Make an HTTP request to the OKRunit API."""
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        print(f"OKRunit API error ({e.code}): {error_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="OKRunit Approval Gate for Terraform"
    )
    parser.add_argument("--title", default="Terraform approval required")
    parser.add_argument("--description", default="")
    parser.add_argument(
        "--priority",
        default="medium",
        choices=["low", "medium", "high", "critical"],
    )
    parser.add_argument("--metadata", default="", help="JSON string")
    parser.add_argument(
        "--timeout", type=int, default=int(os.environ.get("OKRUNIT_TIMEOUT", "3600"))
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=int(os.environ.get("OKRUNIT_POLL_INTERVAL", "10")),
    )
    args = parser.parse_args()

    api_key = os.environ.get("OKRUNIT_API_KEY", "")
    api_url = os.environ.get("OKRUNIT_API_URL", "https://app.okrunit.com")

    if not api_key:
        print("Error: OKRUNIT_API_KEY environment variable is required", file=sys.stderr)
        sys.exit(1)

    # Generate idempotency key from Terraform context
    workspace = os.environ.get("TF_WORKSPACE", "default")
    resource = os.environ.get("TF_VAR_resource_address", "unknown")
    idempotency_key = f"terraform-{workspace}-{resource}-{int(time.time())}"

    # Build request body
    body: dict = {
        "title": args.title,
        "source": "terraform",
        "priority": args.priority,
        "idempotency_key": idempotency_key,
    }

    if args.description:
        body["description"] = args.description

    if args.metadata:
        try:
            body["metadata"] = json.loads(args.metadata)
        except json.JSONDecodeError:
            print("Warning: metadata is not valid JSON, skipping", file=sys.stderr)

    # Create approval request
    print(f'Creating approval request: "{args.title}"')
    approval = api_request(
        "POST", f"{api_url}/api/v1/approvals", api_key, body
    )

    approval_id = approval.get("id")
    if not approval_id:
        print("Error: Failed to create approval request", file=sys.stderr)
        print(json.dumps(approval, indent=2), file=sys.stderr)
        sys.exit(1)

    print(f"Approval created: {approval_id}")
    print(
        f"Waiting for decision (timeout: {args.timeout}s, poll every: {args.poll_interval}s)..."
    )

    # Poll for decision
    deadline = time.time() + args.timeout
    elapsed = 0

    while time.time() < deadline:
        time.sleep(args.poll_interval)
        elapsed += args.poll_interval

        result = api_request(
            "GET", f"{api_url}/api/v1/approvals/{approval_id}", api_key
        )

        status = result.get("status", "")
        decided_by = result.get("decided_by_name", "unknown")
        comment = result.get("decision_comment", "")

        if status == "approved":
            msg = f"Approved by {decided_by}"
            if comment:
                msg += f" -- {comment}"
            print(msg)
            sys.exit(0)

        if status == "rejected":
            msg = f"Rejected by {decided_by}"
            if comment:
                msg += f" -- {comment}"
            print(msg, file=sys.stderr)
            sys.exit(1)

        print(f"Still waiting... ({elapsed}s elapsed)")

    print(
        f"Error: Approval timed out after {args.timeout}s. Approval ID: {approval_id}",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
