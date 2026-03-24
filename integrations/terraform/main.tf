# OKRunit Approval Gate — Terraform Example Module
#
# This module demonstrates how to gate destructive Terraform operations
# behind human approval using OKRunit.
#
# Usage:
#   1. Set OKRUNIT_API_KEY in your environment
#   2. Optionally set OKRUNIT_API_URL (defaults to https://app.okrunit.com)
#   3. Run: terraform apply

terraform {
  required_version = ">= 1.0"
}

variable "okrunit_api_url" {
  description = "OKRunit API base URL"
  type        = string
  default     = "https://app.okrunit.com"
}

variable "approval_title" {
  description = "Title for the approval request"
  type        = string
  default     = "Terraform apply requires approval"
}

variable "approval_description" {
  description = "Description for the approval request"
  type        = string
  default     = ""
}

variable "approval_priority" {
  description = "Priority: low, medium, high, critical"
  type        = string
  default     = "medium"

  validation {
    condition     = contains(["low", "medium", "high", "critical"], var.approval_priority)
    error_message = "Priority must be one of: low, medium, high, critical."
  }
}

variable "approval_metadata" {
  description = "JSON metadata to attach to the approval"
  type        = string
  default     = "{}"
}

variable "approval_timeout" {
  description = "Max seconds to wait for approval"
  type        = number
  default     = 3600
}

# ---------------------------------------------------------------------------
# Option A: External data source (use in data-only contexts)
# Runs the approval script and returns the result as data.
# ---------------------------------------------------------------------------
data "external" "approval" {
  program = [
    "bash", "-c",
    <<-EOT
      RESULT=$(${path.module}/scripts/approve.sh \
        --title "${var.approval_title}" \
        --description "${var.approval_description}" \
        --priority "${var.approval_priority}" \
        --metadata '${var.approval_metadata}' \
        --timeout "${var.approval_timeout}" 2>&1) && \
      echo '{"status":"approved","output":"'"$(echo $RESULT | tail -1)"'"}' || \
      echo '{"status":"rejected","output":"'"$(echo $RESULT | tail -1)"'"}'
    EOT
  ]
}

# ---------------------------------------------------------------------------
# Option B: null_resource with local-exec provisioner
# Use this to gate a specific resource behind approval.
# ---------------------------------------------------------------------------
resource "null_resource" "approval_gate" {
  # Re-run approval whenever the title or metadata changes
  triggers = {
    title    = var.approval_title
    metadata = var.approval_metadata
  }

  provisioner "local-exec" {
    command = <<-EOT
      ${path.module}/scripts/approve.sh \
        --title "${var.approval_title}" \
        --description "${var.approval_description}" \
        --priority "${var.approval_priority}" \
        --metadata '${var.approval_metadata}' \
        --timeout "${var.approval_timeout}"
    EOT

    environment = {
      OKRUNIT_API_URL = var.okrunit_api_url
    }
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "approval_status" {
  description = "Result from the external data source approval"
  value       = data.external.approval.result["status"]
}

output "approval_output" {
  description = "Output message from the approval script"
  value       = data.external.approval.result["output"]
}
