# OKRunit Approval Gate -- Terraform

Gate destructive Terraform operations behind human approval using [OKRunit](https://okrunit.com). Supports both shell (bash) and Python scripts, usable as external data sources, local-exec provisioners, or standalone CLI tools.

## Quick Start

```bash
# Set your API key
export OKRUNIT_API_KEY="gk_your_api_key_here"

# Run directly
./scripts/approve.sh --title "Destroy production database" --priority critical

# Or use the Python version (no dependencies beyond stdlib)
python scripts/approve.py --title "Destroy production database" --priority critical
```

## Usage in Terraform

### As a null_resource provisioner (recommended)

Gate a specific resource behind approval by adding a dependency:

```hcl
resource "null_resource" "approval" {
  triggers = {
    title = "Apply changes to ${terraform.workspace}"
  }

  provisioner "local-exec" {
    command = <<-EOT
      ${path.module}/scripts/approve.sh \
        --title "Apply changes to ${terraform.workspace}" \
        --description "Terraform plan includes ${length(var.changes)} changes" \
        --priority high \
        --metadata '{"workspace":"${terraform.workspace}","region":"${var.region}"}'
    EOT
  }
}

# This resource only gets created after approval
resource "aws_instance" "production" {
  depends_on = [null_resource.approval]

  ami           = var.ami_id
  instance_type = "t3.large"
}
```

### As an external data source

Use the approval result in conditional logic:

```hcl
data "external" "approval" {
  program = ["bash", "${path.module}/scripts/approve.sh",
    "--title", "Deploy to production",
    "--priority", "critical"
  ]
}

output "was_approved" {
  value = data.external.approval.result["status"]
}
```

### Using the example module

```hcl
module "approval" {
  source = "github.com/okrunit/okrunit//integrations/terraform"

  approval_title       = "Deploy v2.3 to production"
  approval_description = "Includes database migration"
  approval_priority    = "critical"
  approval_metadata    = jsonencode({
    workspace = terraform.workspace
    region    = var.region
  })
  approval_timeout = 1800
}
```

## Script Reference

### approve.sh / approve.py

Both scripts accept the same arguments and behave identically:

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--title` | No | `Terraform approval required` | Approval request title |
| `--description` | No | -- | Context for the reviewer |
| `--priority` | No | `medium` | `low`, `medium`, `high`, `critical` |
| `--metadata` | No | -- | JSON string with additional context |
| `--timeout` | No | `3600` | Max wait time in seconds |
| `--poll-interval` | No | `10` | Seconds between status checks |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OKRUNIT_API_KEY` | Yes | -- | API key (starts with `gk_`) |
| `OKRUNIT_API_URL` | No | `https://app.okrunit.com` | OKRunit instance URL |
| `OKRUNIT_TIMEOUT` | No | `3600` | Default timeout (overridden by `--timeout`) |
| `OKRUNIT_POLL_INTERVAL` | No | `10` | Default poll interval (overridden by `--poll-interval`) |
| `TF_WORKSPACE` | No | `default` | Used in idempotency key generation |
| `TF_VAR_resource_address` | No | `unknown` | Used in idempotency key generation |

### Exit Codes

- `0` -- Approved
- `1` -- Rejected, timed out, or error

### Dependencies

**approve.sh** requires `bash`, `curl`, and `jq`.

**approve.py** uses only Python standard library (no pip install needed). Requires Python 3.10+.

## Behavior

1. The script creates an approval request via `POST /api/v1/approvals` with `source: "terraform"`
2. An idempotency key is auto-generated from `TF_WORKSPACE`, `TF_VAR_resource_address`, and the current timestamp
3. The script polls `GET /api/v1/approvals/{id}` every N seconds
4. On **approved**: exits 0, Terraform continues
5. On **rejected**: exits 1, Terraform aborts
6. On **timeout**: exits 1, Terraform aborts

## CI/CD Integration

### GitHub Actions + Terraform

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Plan
        run: terraform plan -out=tfplan

      - name: Request Approval
        env:
          OKRUNIT_API_KEY: ${{ secrets.OKRUNIT_API_KEY }}
          TF_WORKSPACE: production
        run: |
          chmod +x integrations/terraform/scripts/approve.sh
          ./integrations/terraform/scripts/approve.sh \
            --title "Apply Terraform changes to production" \
            --priority critical \
            --timeout 1800

      - name: Terraform Apply
        run: terraform apply tfplan
```

### GitLab CI

```yaml
approve_and_apply:
  stage: deploy
  script:
    - terraform plan -out=tfplan
    - python integrations/terraform/scripts/approve.py
        --title "Apply Terraform to $CI_ENVIRONMENT_NAME"
        --priority high
    - terraform apply tfplan
  variables:
    OKRUNIT_API_KEY: $OKRUNIT_API_KEY
    TF_WORKSPACE: production
```
