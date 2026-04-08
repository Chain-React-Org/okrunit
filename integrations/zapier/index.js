// ---------------------------------------------------------------------------
// OKRunit Zapier Integration -- App Definition
// ---------------------------------------------------------------------------

const {
  authentication,
  addAuthHeader,
  handleErrors,
} = require("./authentication");

// Triggers (user-facing)
const newApproval = require("./triggers/new_approval");
const approvalDecided = require("./triggers/approval_decided");

// Triggers (hidden, power dynamic dropdowns in the Zap editor)
const actionTypes = require("./triggers/action_types");
const teamMembers = require("./triggers/team_members");
const teams = require("./triggers/teams");
const templates = require("./triggers/templates");

// Actions
const requestApproval = require("./creates/request_approval");
const createApproval = require("./creates/create_approval");
const addComment = require("./creates/add_comment");

// Searches
const getApproval = require("./searches/get_approval");
const listApprovals = require("./searches/list_approvals");

module.exports = {
  version: require("./package.json").version,
  platformVersion: require("zapier-platform-core").version,

  authentication,

  beforeRequest: [addAuthHeader],
  afterResponse: [handleErrors],

  // Disable automatic input cleaning for predictable behavior
  flags: {
    cleanInputData: false,
  },

  triggers: {
    [newApproval.key]: newApproval,
    [approvalDecided.key]: approvalDecided,
    [actionTypes.key]: actionTypes,
    [teamMembers.key]: teamMembers,
    [teams.key]: teams,
    [templates.key]: templates,
  },

  creates: {
    [requestApproval.key]: requestApproval,
    [createApproval.key]: createApproval,
    [addComment.key]: addComment,
  },

  searches: {
    [getApproval.key]: getApproval,
    [listApprovals.key]: listApprovals,
  },
};
