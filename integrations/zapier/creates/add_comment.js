// ---------------------------------------------------------------------------
// OKRunit Zapier -- Add Comment to Approval
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const addComment = {
  key: "add_comment",
  noun: "Comment",

  display: {
    label: "Add Comment",
    description: "Add a comment to an existing approval request.",
  },

  operation: {
    inputFields: [
      {
        key: "approval_id",
        label: "Approval ID",
        type: "string",
        required: true,
        helpText: "The UUID of the approval request to comment on.",
        dynamic: "new_approval.id.title",
      },
      {
        key: "body",
        label: "Comment",
        type: "text",
        required: true,
        helpText: "The comment text (max 5000 characters).",
      },
    ],

    perform: async (z, bundle) => {
      try {
        const response = await z.request({
          method: "POST",
          url: `${OKRUNIT_URL}/api/v1/approvals/${bundle.inputData.approval_id}/comments`,
          body: { body: bundle.inputData.body },
        });

        return response.json;
      } catch (err) {
        if (err.status === 404) {
          throw new z.errors.Error(
            "The approval request was not found. It may have been deleted.",
            "NOT_FOUND",
            404,
          );
        }
        throw err;
      }
    },

    sample: {
      id: "660e8400-e29b-41d4-a716-446655440001",
      approval_id: "550e8400-e29b-41d4-a716-446655440000",
      body: "Looks good, proceeding with approval.",
      created_by: "770e8400-e29b-41d4-a716-446655440002",
      created_at: "2026-02-21T10:05:00.000Z",
    },

    outputFields: [
      { key: "id", label: "Comment ID" },
      { key: "approval_id", label: "Approval ID" },
      { key: "body", label: "Comment" },
      { key: "created_by", label: "Created By" },
      { key: "created_at", label: "Created At", type: "datetime" },
    ],
  },
};

module.exports = addComment;
