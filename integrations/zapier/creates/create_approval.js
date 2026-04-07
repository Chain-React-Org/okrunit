// ---------------------------------------------------------------------------
// OKRunit Zapier -- Create Activity Log
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const createApproval = {
  key: "create_approval",
  noun: "Activity Log",

  display: {
    label: "Create Activity Log",
    description:
      "Log an activity for audit and tracking purposes. This does not create an approval request. The Zap continues immediately.",
  },

  operation: {
    inputFields: [
      {
        key: "title",
        label: "Title",
        type: "string",
        required: true,
        helpText:
          "Short title for the activity log entry (max 500 characters). Use the + button to insert dynamic data from previous steps.",
      },
      {
        key: "description",
        label: "Description",
        type: "text",
        required: false,
        helpText:
          "Detailed description (max 5000 characters). Use the + button to insert dynamic data from previous steps.",
      },
      {
        key: "source_url",
        label: "Zap URL",
        type: "string",
        required: false,
        helpText:
          "Paste the URL of this Zap from your browser address bar so team members can jump back to it from the dashboard.",
      },
      {
        key: "metadata",
        label: "Metadata (JSON)",
        type: "string",
        required: false,
        helpText:
          'Optional JSON data to attach (e.g. {"order_id": "123"}). This data is stored with the log entry for reference.',
      },
    ],

    perform: async (z, bundle) => {
      // Auto-generate idempotency key to prevent duplicates
      const idempotencyKey = `zap-${bundle.meta.zap?.id || "unknown"}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const body = {
        title: bundle.inputData.title,
        idempotency_key: idempotencyKey,
        source: "zapier",
        source_id: String(bundle.meta.zap?.id || ""),
        is_log: true,
      };

      if (bundle.inputData.description) {
        body.description = bundle.inputData.description;
      }

      if (bundle.inputData.source_url) {
        body.source_url = bundle.inputData.source_url;
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

      const response = await z.request({
        method: "POST",
        url: `${OKRUNIT_URL}/api/v1/approvals`,
        body,
      });

      return response.json;
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Deploy v2.3.1 to production",
      description: "Release includes new payment flow",
      status: "approved",
      priority: "medium",
      source: "zapier",
      is_log: true,
      created_at: "2026-02-21T10:00:00.000Z",
    },

    outputFields: [
      { key: "id", label: "Log ID" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "source", label: "Source" },
      { key: "created_at", label: "Created At", type: "datetime" },
    ],
  },
};

module.exports = createApproval;
