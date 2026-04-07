// ---------------------------------------------------------------------------
// OKRunit Zapier -- New Approval Request Trigger (Polling)
// ---------------------------------------------------------------------------
// Triggers when a new approval request is created in your organization.
// Zapier deduplicates by `id`, so returning newest first ensures only truly
// new items fire the trigger.
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const newApproval = {
  key: "new_approval",
  noun: "Approval Request",

  display: {
    label: "New Approval Request",
    description:
      "Triggers when a new approval request is created in your organization.",
  },

  operation: {
    type: "polling",

    inputFields: [
      {
        key: "status_filter",
        label: "Status",
        type: "string",
        required: false,
        choices: {
          pending: "Pending",
          approved: "Approved",
          rejected: "Rejected",
          cancelled: "Cancelled",
          expired: "Expired",
        },
        helpText: "Only trigger for approvals with this status. Leave empty for all.",
      },
      {
        key: "priority_filter",
        label: "Priority",
        type: "string",
        required: false,
        choices: {
          low: "Low",
          medium: "Medium",
          high: "High",
          critical: "Critical",
        },
        helpText: "Only trigger for approvals with this priority. Leave empty for all.",
      },
    ],

    perform: async (z, bundle) => {
      const params = { page_size: 50 };

      if (bundle.inputData.status_filter) {
        params.status = bundle.inputData.status_filter;
      }
      if (bundle.inputData.priority_filter) {
        params.priority = bundle.inputData.priority_filter;
      }

      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/approvals`,
        params,
      });

      // Return newest first. Zapier deduplicates by `id`
      return response.json.data || [];
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Deploy v2.3.1 to production",
      description: "Release includes new payment flow",
      status: "pending",
      priority: "high",
      action_type: "deploy",
      source: "api",
      required_approvals: 1,
      current_approvals: 0,
      created_at: "2026-02-21T10:00:00.000Z",
      updated_at: "2026-02-21T10:00:00.000Z",
    },

    outputFields: [
      { key: "id", label: "Approval ID" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "action_type", label: "Action Type" },
      { key: "source", label: "Source" },
      { key: "required_approvals", label: "Required Approvals", type: "integer" },
      { key: "current_approvals", label: "Current Approvals", type: "integer" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
  },
};

module.exports = newApproval;
