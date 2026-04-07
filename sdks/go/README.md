# okrunit-go

Official Go SDK for the OKRunit approval gateway API.

## Installation

```bash
go get github.com/okrunit/okrunit-go
```

## Quick Start

```go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	okrunit "github.com/okrunit/okrunit-go"
)

func main() {
	client := okrunit.NewClient("gk_your_api_key_here")

	ctx := context.Background()

	// Create an approval request
	approval, err := client.CreateApproval(ctx, okrunit.CreateApprovalParams{
		Title:       "Deploy v2.3 to production",
		Priority:    okrunit.PriorityHigh,
		CallbackURL: "https://your-app.com/webhook",
		Metadata:    map[string]interface{}{"version": "2.3"},
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Created approval: %s\n", approval.ID)

	// Wait for a decision (blocks until resolved or context cancelled)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	decided, err := client.WaitForDecision(ctx, approval.ID, 2*time.Second)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Decision: %s\n", decided.Status)

	// List pending approvals
	pending, err := client.ListApprovals(ctx, &okrunit.ListApprovalsParams{
		Status: okrunit.StatusPending,
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Pending: %d approvals\n", pending.Total)

	// Add a comment
	_, err = client.AddComment(ctx, approval.ID, "Deployment pipeline is ready")
	if err != nil {
		log.Fatal(err)
	}
}
```

## API Reference

### `NewClient(apiKey string, opts ...Option) *Client`

Options:
- `WithBaseURL(url)` - custom API base URL (default: `https://okrunit.com`)
- `WithTimeout(duration)` - HTTP timeout (default: 30s)
- `WithHTTPClient(client)` - custom `*http.Client`

### Methods

| Method | Description |
|---|---|
| `CreateApproval(ctx, params)` | Create a new approval request |
| `GetApproval(ctx, id)` | Get a single approval by ID |
| `ListApprovals(ctx, params)` | List approvals with optional filters |
| `RespondToApproval(ctx, id, params)` | Approve or reject an approval |
| `CancelApproval(ctx, id)` | Cancel a pending approval |
| `BatchRespond(ctx, params)` | Batch approve/reject multiple approvals |
| `WaitForDecision(ctx, id, interval)` | Poll until terminal state or context done |
| `ListComments(ctx, approvalID)` | List comments on an approval |
| `AddComment(ctx, approvalID, body)` | Add a comment to an approval |
