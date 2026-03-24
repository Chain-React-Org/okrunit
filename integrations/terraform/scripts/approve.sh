#!/usr/bin/env bash
# OKRunit Approval Gate for Terraform
# Creates an approval request and polls until a decision is made.
#
# Environment variables:
#   OKRUNIT_API_KEY  (required) — API key starting with gk_
#   OKRUNIT_API_URL  (optional) — Base URL, defaults to https://app.okrunit.com
#
# Usage:
#   ./approve.sh --title "Destroy production DB" --priority critical
#   ./approve.sh --title "Apply changes" --description "Adding 3 EC2 instances" --metadata '{"workspace":"prod"}'

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
OKRUNIT_API_URL="${OKRUNIT_API_URL:-https://app.okrunit.com}"
POLL_INTERVAL="${OKRUNIT_POLL_INTERVAL:-10}"
TIMEOUT="${OKRUNIT_TIMEOUT:-3600}"

TITLE=""
DESCRIPTION=""
PRIORITY="medium"
METADATA=""

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)       TITLE="$2";       shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --priority)    PRIORITY="$2";    shift 2 ;;
    --metadata)    METADATA="$2";    shift 2 ;;
    --timeout)     TIMEOUT="$2";     shift 2 ;;
    --poll-interval) POLL_INTERVAL="$2"; shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if [[ -z "${OKRUNIT_API_KEY:-}" ]]; then
  echo "Error: OKRUNIT_API_KEY environment variable is required" >&2
  exit 1
fi

if [[ -z "$TITLE" ]]; then
  TITLE="Terraform approval required"
fi

VALID_PRIORITIES="low medium high critical"
if ! echo "$VALID_PRIORITIES" | grep -qw "$PRIORITY"; then
  echo "Error: Invalid priority '$PRIORITY'. Must be one of: $VALID_PRIORITIES" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Generate idempotency key from Terraform context
# ---------------------------------------------------------------------------
TF_WORKSPACE="${TF_WORKSPACE:-default}"
TF_RESOURCE="${TF_VAR_resource_address:-unknown}"
IDEMPOTENCY_KEY="terraform-${TF_WORKSPACE}-${TF_RESOURCE}-$(date +%s)"

# ---------------------------------------------------------------------------
# Build JSON body
# ---------------------------------------------------------------------------
BODY=$(cat <<ENDJSON
{
  "title": $(printf '%s' "$TITLE" | jq -Rs .),
  "source": "terraform",
  "priority": "$PRIORITY",
  "idempotency_key": "$IDEMPOTENCY_KEY"
ENDJSON
)

if [[ -n "$DESCRIPTION" ]]; then
  BODY="$BODY, \"description\": $(printf '%s' "$DESCRIPTION" | jq -Rs .)"
fi

if [[ -n "$METADATA" ]]; then
  # Validate that metadata is valid JSON
  if echo "$METADATA" | jq empty 2>/dev/null; then
    BODY="$BODY, \"metadata\": $METADATA"
  else
    echo "Warning: metadata is not valid JSON, skipping" >&2
  fi
fi

BODY="$BODY}"

# ---------------------------------------------------------------------------
# Create approval request
# ---------------------------------------------------------------------------
echo "Creating approval request: $TITLE"

CREATE_RESPONSE=$(curl -sf \
  -X POST \
  -H "Authorization: Bearer ${OKRUNIT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "${OKRUNIT_API_URL}/api/v1/approvals")

APPROVAL_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')

if [[ -z "$APPROVAL_ID" || "$APPROVAL_ID" == "null" ]]; then
  echo "Error: Failed to create approval request" >&2
  echo "$CREATE_RESPONSE" >&2
  exit 1
fi

echo "Approval created: $APPROVAL_ID"
echo "Waiting for decision (timeout: ${TIMEOUT}s, poll every: ${POLL_INTERVAL}s)..."

# ---------------------------------------------------------------------------
# Poll for decision
# ---------------------------------------------------------------------------
DEADLINE=$(($(date +%s) + TIMEOUT))
ELAPSED=0

while [[ $(date +%s) -lt $DEADLINE ]]; do
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  POLL_RESPONSE=$(curl -sf \
    -H "Authorization: Bearer ${OKRUNIT_API_KEY}" \
    "${OKRUNIT_API_URL}/api/v1/approvals/${APPROVAL_ID}")

  STATUS=$(echo "$POLL_RESPONSE" | jq -r '.status')

  if [[ "$STATUS" == "approved" ]]; then
    DECIDED_BY=$(echo "$POLL_RESPONSE" | jq -r '.decided_by_name // "unknown"')
    COMMENT=$(echo "$POLL_RESPONSE" | jq -r '.decision_comment // empty')
    echo "Approved by ${DECIDED_BY}${COMMENT:+ — $COMMENT}"
    exit 0
  fi

  if [[ "$STATUS" == "rejected" ]]; then
    DECIDED_BY=$(echo "$POLL_RESPONSE" | jq -r '.decided_by_name // "unknown"')
    COMMENT=$(echo "$POLL_RESPONSE" | jq -r '.decision_comment // empty')
    echo "Rejected by ${DECIDED_BY}${COMMENT:+ — $COMMENT}" >&2
    exit 1
  fi

  echo "Still waiting... (${ELAPSED}s elapsed)"
done

echo "Error: Approval timed out after ${TIMEOUT}s. Approval ID: ${APPROVAL_ID}" >&2
exit 1
