// ---------------------------------------------------------------------------
// OKRunit Zapier -- Get Approval by ID
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const getApproval = {
  key: "get_approval",
  noun: "Approval Request",

  display: {
    label: "Find Approval Request",
    description: "Find a specific approval request by its ID.",
  },

  operation: {
    inputFields: [
      {
        key: "approval_id",
        label: "Approval ID",
        type: "string",
        required: true,
        helpText: "The UUID of the approval request.",
        dynamic: "new_approval.id.title",
      },
    ],

    perform: async (z, bundle) => {
      try {
        const response = await z.request({
          url: `${OKRUNIT_URL}/api/v1/approvals/${bundle.inputData.approval_id}`,
        });

        return [response.json];
      } catch (err) {
        // Zapier searches must return [] when no result is found, not throw.
        if (err.status === 404) {
          return [];
        }
        throw err;
      }
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Deploy v2.3.1 to production",
      description: "Release includes new payment flow",
      status: "approved",
      priority: "high",
      action_type: "deploy",
      source: "api",
      required_approvals: 1,
      current_approvals: 1,
      requested_by_name: "Jane Smith",
      decided_by: "770e8400-e29b-41d4-a716-446655440002",
      decided_by_name: "John Doe",
      decided_at: "2026-02-21T10:30:00.000Z",
      decision_comment: "Looks good, ship it!",
      created_at: "2026-02-21T10:00:00.000Z",
      updated_at: "2026-02-21T10:30:00.000Z",
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
      { key: "requested_by_name", label: "Requested By" },
      { key: "decided_by", label: "Decided By (User ID)" },
      { key: "decided_by_name", label: "Decided By (Name)" },
      { key: "decided_at", label: "Decided At", type: "datetime" },
      { key: "decision_comment", label: "Comment" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
  },
};

module.exports = getApproval;
