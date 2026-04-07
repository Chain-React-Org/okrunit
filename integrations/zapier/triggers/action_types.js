// ---------------------------------------------------------------------------
// OKRunit Zapier -- Action Types (Hidden Trigger for Dynamic Dropdown)
// ---------------------------------------------------------------------------
// This trigger is NOT user-facing. It powers the dynamic dropdown for the
// "Action Type" field in create/request approval actions.
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const actionTypes = {
  key: "action_types",
  noun: "Action Type",

  display: {
    label: "Action Types",
    description: "Lists the action types configured in your organization.",
    hidden: true,
  },

  operation: {
    type: "polling",

    perform: async (z) => {
      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/org/action-types`,
      });

      const types = response.json.data || [];

      // Zapier dynamic dropdowns expect an array of objects with `id` and a
      // label-like field.  We use the action type string as both.
      return types.map((type) => ({
        id: type,
        name: type,
      }));
    },

    sample: {
      id: "deploy",
      name: "deploy",
    },

    outputFields: [
      { key: "id", label: "Action Type Value" },
      { key: "name", label: "Action Type Label" },
    ],
  },
};

module.exports = actionTypes;
