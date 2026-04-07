// ---------------------------------------------------------------------------
// OKRunit Zapier -- Team Members (Hidden Trigger for Dynamic Dropdown)
// ---------------------------------------------------------------------------
// This trigger is NOT user-facing. It powers the dynamic dropdown for the
// "Assigned Approvers" field in create/request approval actions.
// Only returns members with approval permissions (can_approve = true).
// ---------------------------------------------------------------------------

const { OKRUNIT_URL } = require("../authentication");

const teamMembers = {
  key: "team_members",
  noun: "Team Member",

  display: {
    label: "Team Members",
    description: "Lists the team members in your organization.",
    hidden: true,
  },

  operation: {
    type: "polling",

    perform: async (z) => {
      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/team/members`,
        params: { can_approve: "true" },
      });

      const members = response.json.data || [];

      return members.map((member) => ({
        id: member.id,
        name: member.full_name || member.email,
        email: member.email,
        role: member.role,
      }));
    },

    sample: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "admin",
    },

    outputFields: [
      { key: "id", label: "User ID" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
    ],
  },
};

module.exports = teamMembers;
