// ---------------------------------------------------------------------------
// OKRunit Zapier -- Teams (Hidden Trigger for Dynamic Dropdown)
// ---------------------------------------------------------------------------
// This trigger is NOT user-facing. It powers the dynamic dropdown for the
// "Assign to Team" field in create/request approval actions.
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const teams = {
  key: "teams",
  noun: "Team",

  display: {
    label: "Teams",
    description: "Lists the teams in your organization.",
    hidden: true,
  },

  operation: {
    type: "polling",

    perform: async (z) => {
      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/teams`,
      });

      const teamsData = response.json.data || [];

      return teamsData.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description || "",
        member_count: team.member_count || 0,
      }));
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Engineering",
      description: "Engineering team approvers",
      member_count: 5,
    },

    outputFields: [
      { key: "id", label: "Team ID" },
      { key: "name", label: "Team Name" },
      { key: "description", label: "Description" },
      { key: "member_count", label: "Member Count", type: "integer" },
    ],
  },
};

module.exports = teams;
