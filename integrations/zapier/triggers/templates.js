// ---------------------------------------------------------------------------
// OKRunit Zapier -- Templates (Hidden Trigger for Dynamic Dropdown)
// ---------------------------------------------------------------------------
// This trigger is NOT user-facing. It powers the dynamic dropdown for the
// "Template" field in create/request approval actions.
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const templates = {
  key: "templates",
  noun: "Template",

  display: {
    label: "Templates",
    description: "Lists the approval templates configured in your organization.",
    hidden: true,
  },

  operation: {
    type: "polling",

    perform: async (z) => {
      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/templates`,
      });

      const data = response.json.data || [];

      return data.map((template) => ({
        id: template.id,
        name: template.description
          ? `${template.name} - ${template.description}`
          : template.name,
      }));
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Production Deploy",
    },

    outputFields: [
      { key: "id", label: "Template ID" },
      { key: "name", label: "Template Name" },
    ],
  },
};

module.exports = templates;
