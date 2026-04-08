// ---------------------------------------------------------------------------
// OKRunit Zapier -- Request Approval (Send & Wait)
// ---------------------------------------------------------------------------
// This action creates an approval request and PAUSES the Zap until a human
// approves or rejects. Zapier resumes via the callback URL.
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const requestApproval = {
  key: "request_approval",
  noun: "Approval",

  display: {
    label: "Request Approval",
    description:
      "Pause this Zap until a human approves or rejects. The next step runs only after a decision is made.",
  },

  operation: {
    inputFields: [
      {
        key: "template_id",
        label: "Template",
        type: "string",
        required: false,
        dynamic: "templates.id.name",
        helpText:
          "Select a template to pre-fill fields like priority, action type, and assigned approvers. Any fields you fill in below will override the template defaults.",
      },
      {
        key: "title",
        label: "What needs approval?",
        type: "string",
        required: false,
        helpText:
          "A short description of what you want approved (e.g. 'Send invoice #1234 to client'). If left blank, you'll need to edit the title in your dashboard. Use the + button to insert dynamic data from previous steps.",
      },
      {
        key: "description",
        label: "Details",
        type: "text",
        required: false,
        helpText:
          "Additional context for the reviewer (optional). Use the + button to insert dynamic data from previous steps.",
      },
      {
        key: "metadata",
        label: "Metadata (JSON)",
        type: "string",
        required: false,
        helpText:
          'Optional JSON data to attach (e.g. {"order_id": "123"}). Routing rules, priority, expiration, and approvers are all configured in your dashboard.',
      },
    ],

    // -- Step 1: Create the approval and give OKRunit the callback URL ---
    perform: async (z, bundle) => {
      const callbackUrl = z.generateCallbackUrl();

      // Auto-generate idempotency key to prevent duplicates
      const idempotencyKey = `zap-${bundle.meta.zap?.id || "unknown"}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const title =
        bundle.inputData.title ||
        `Approval request from Zapier`;

      const body = {
        title,
        callback_url: callbackUrl,
        idempotency_key: idempotencyKey,
        source: "zapier",
        source_id: String(bundle.meta.zap?.id || ""),
      };

      if (bundle.inputData.template_id) {
        body.template_id = bundle.inputData.template_id;
      }

      if (bundle.inputData.description) {
        body.description = bundle.inputData.description;
      }

      if (bundle.inputData.metadata) {
        try {
          body.metadata = JSON.parse(bundle.inputData.metadata);
        } catch {
          throw new z.errors.Error(
            "Metadata must be valid JSON",
            "INVALID_JSON",
            400,
          );
        }
      }

      // During Zap setup / testing, return sample data immediately so users
      // can map fields in later steps without waiting for a real decision.
      if (bundle.meta.isLoadingSample) {
        return {
          id: "sample-approval-id",
          title,
          status: "approved",
          priority: "medium",
          decision: "approved",
          decided_by: "sample-user-id",
          decided_by_name: "Jane Smith",
          decision_comment: "Looks good!",
          created_at: new Date().toISOString(),
          decided_at: new Date().toISOString(),
        };
      }

      const response = await z.request({
        method: "POST",
        url: `${OKRUNIT_URL}/api/v1/approvals`,
        body,
      });

      // Return the created approval. Zapier will hold here until the
      // callback URL is POSTed to, then run performResume.
      return response.json;
    },

    // -- Step 2: Resume when OKRunit POSTs the decision back ------------
    performResume: async (z, bundle) => {
      // bundle.outputData = what perform() returned (the approval)
      // bundle.cleanedRequest = the POST body from OKRunit's callback
      const callback = bundle.cleanedRequest;
      const original = bundle.outputData || {};

      // If the request was rejected, halt the Zap so downstream steps don't run.
      if (callback.status === "rejected") {
        throw new z.errors.HaltedError(
          callback.decision_comment
            ? `Request rejected: ${callback.decision_comment}`
            : "Request was rejected",
        );
      }

      return {
        id: callback.id || original.id,
        title: callback.title || original.title,
        status: callback.status,
        decision: callback.status,
        priority: callback.priority || original.priority,
        decided_by: callback.decided_by || "",
        decided_by_name: callback.decided_by_name || "",
        decision_comment: callback.decision_comment || "",
        metadata: callback.metadata || original.metadata,
        created_at: original.created_at,
        decided_at: callback.decided_at,
      };
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Deploy v2.3.1 to production",
      description: "Release includes new payment flow",
      status: "pending",
      priority: "medium",
      source: "make",
      decided_by: null,
      decided_by_name: null,
      decision_comment: null,
      created_at: "2026-02-21T10:00:00.000Z",
      decided_at: null,
    },

    outputFields: [
      { key: "id", label: "Approval ID" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "source", label: "Source" },
      { key: "decided_by", label: "Decided By (User ID)" },
      { key: "decided_by_name", label: "Decided By (Name)" },
      { key: "decision_comment", label: "Comment" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "decided_at", label: "Decided At", type: "datetime" },
    ],
  },
};

module.exports = requestApproval;
