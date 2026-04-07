// ---------------------------------------------------------------------------
// OKRunit Zapier -- Searches Tests
// ---------------------------------------------------------------------------

const zapier = require("zapier-platform-core");
const App = require("../index");

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

// ---------------------------------------------------------------------------
// getApproval search
// ---------------------------------------------------------------------------

describe("Get Approval", () => {
  const op = App.searches.get_approval.operation;

  it("has correct sample data matching spec exactly", () => {
    const sample = op.sample;
    expect(sample.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sample.title).toBe("Deploy v2.3.1 to production");
    expect(sample.description).toBe("Release includes new payment flow");
    expect(sample.status).toBe("approved");
    expect(sample.priority).toBe("high");
    expect(sample.action_type).toBe("deploy");
    expect(sample.source).toBe("api");
    expect(sample.required_approvals).toBe(1);
    expect(sample.current_approvals).toBe(1);
    expect(sample.requested_by_name).toBe("Jane Smith");
    expect(sample.decided_by).toBe("770e8400-e29b-41d4-a716-446655440002");
    expect(sample.decided_by_name).toBe("John Doe");
    expect(sample.decided_at).toBe("2026-02-21T10:30:00.000Z");
    expect(sample.decision_comment).toBe("Looks good, ship it!");
    expect(sample.created_at).toBe("2026-02-21T10:00:00.000Z");
    expect(sample.updated_at).toBe("2026-02-21T10:30:00.000Z");
    // Verify exact number of sample fields (16 per spec)
    expect(Object.keys(sample).length).toBe(16);
  });

  it("has exactly 16 output fields matching spec", () => {
    const fields = op.outputFields;
    expect(fields.length).toBe(16);
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual([
      "id",
      "title",
      "description",
      "status",
      "priority",
      "action_type",
      "source",
      "required_approvals",
      "current_approvals",
      "requested_by_name",
      "decided_by",
      "decided_by_name",
      "decided_at",
      "decision_comment",
      "created_at",
      "updated_at",
    ]);
  });

  it("has source field in outputFields", () => {
    const keys = op.outputFields.map((f) => f.key);
    expect(keys).toContain("source");
  });

  it("has requested_by_name field in outputFields", () => {
    const keys = op.outputFields.map((f) => f.key);
    expect(keys).toContain("requested_by_name");
  });

  it("has correct output field labels", () => {
    const fieldMap = {};
    op.outputFields.forEach((f) => { fieldMap[f.key] = f.label; });
    expect(fieldMap.id).toBe("Approval ID");
    expect(fieldMap.title).toBe("Title");
    expect(fieldMap.description).toBe("Description");
    expect(fieldMap.status).toBe("Status");
    expect(fieldMap.priority).toBe("Priority");
    expect(fieldMap.action_type).toBe("Action Type");
    expect(fieldMap.source).toBe("Source");
    expect(fieldMap.required_approvals).toBe("Required Approvals");
    expect(fieldMap.current_approvals).toBe("Current Approvals");
    expect(fieldMap.requested_by_name).toBe("Requested By");
    expect(fieldMap.decided_by).toBe("Decided By (User ID)");
    expect(fieldMap.decided_by_name).toBe("Decided By (Name)");
    expect(fieldMap.decided_at).toBe("Decided At");
    expect(fieldMap.decision_comment).toBe("Comment");
    expect(fieldMap.created_at).toBe("Created At");
    expect(fieldMap.updated_at).toBe("Updated At");
  });

  it("has correct output field types", () => {
    const typeMap = {};
    op.outputFields.forEach((f) => { typeMap[f.key] = f.type || "text"; });
    expect(typeMap.required_approvals).toBe("integer");
    expect(typeMap.current_approvals).toBe("integer");
    expect(typeMap.decided_at).toBe("datetime");
    expect(typeMap.created_at).toBe("datetime");
    expect(typeMap.updated_at).toBe("datetime");
  });

  it("has required input fields", () => {
    const fields = op.inputFields;
    expect(fields.length).toBe(1);
    expect(fields[0].key).toBe("approval_id");
    expect(fields[0].required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listApprovals search
// ---------------------------------------------------------------------------

describe("List Approvals", () => {
  const op = App.searches.list_approvals.operation;

  it("has correct sample data matching spec exactly", () => {
    const sample = op.sample;
    expect(sample.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sample.title).toBe("Deploy v2.3.1 to production");
    expect(sample.description).toBe("Release includes new payment flow");
    expect(sample.status).toBe("pending");
    expect(sample.priority).toBe("high");
    expect(sample.action_type).toBe("deploy");
    expect(sample.source).toBe("api");
    expect(sample.required_approvals).toBe(1);
    expect(sample.current_approvals).toBe(0);
    expect(sample.requested_by_name).toBe("Jane Smith");
    expect(sample.decided_by).toBeNull();
    expect(sample.decided_by_name).toBeNull();
    expect(sample.decided_at).toBeNull();
    expect(sample.decision_comment).toBeNull();
    expect(sample.created_at).toBe("2026-02-21T10:00:00.000Z");
    expect(sample.updated_at).toBe("2026-02-21T10:00:00.000Z");
    // Verify exact number of sample fields (16 per spec, same as getApproval)
    expect(Object.keys(sample).length).toBe(16);
  });

  it("has exactly 16 output fields matching spec (same as getApproval)", () => {
    const fields = op.outputFields;
    expect(fields.length).toBe(16);
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual([
      "id",
      "title",
      "description",
      "status",
      "priority",
      "action_type",
      "source",
      "required_approvals",
      "current_approvals",
      "requested_by_name",
      "decided_by",
      "decided_by_name",
      "decided_at",
      "decision_comment",
      "created_at",
      "updated_at",
    ]);
  });

  it("has source field in outputFields", () => {
    const keys = op.outputFields.map((f) => f.key);
    expect(keys).toContain("source");
  });

  it("has requested_by_name field in outputFields", () => {
    const keys = op.outputFields.map((f) => f.key);
    expect(keys).toContain("requested_by_name");
  });

  it("has correct output field labels", () => {
    const fieldMap = {};
    op.outputFields.forEach((f) => { fieldMap[f.key] = f.label; });
    expect(fieldMap.id).toBe("Approval ID");
    expect(fieldMap.requested_by_name).toBe("Requested By");
    expect(fieldMap.source).toBe("Source");
    expect(fieldMap.decided_by).toBe("Decided By (User ID)");
    expect(fieldMap.decided_by_name).toBe("Decided By (Name)");
  });

  it("has a limit input field with default 25", () => {
    const fields = op.inputFields;
    const limitField = fields.find((f) => f.key === "limit");
    expect(limitField).toBeDefined();
    expect(limitField.type).toBe("integer");
    expect(limitField.required).toBe(false);
    expect(limitField.default).toBe(25);
  });

  it("has 4 input fields matching spec", () => {
    const fields = op.inputFields;
    expect(fields.length).toBe(4);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("status");
    expect(keys).toContain("priority");
    expect(keys).toContain("search");
    expect(keys).toContain("limit");
  });

  it("status filter has All option and all spec statuses", () => {
    const statusField = op.inputFields.find((f) => f.key === "status");
    expect(statusField.choices[""]).toBe("All");
    expect(statusField.choices.pending).toBe("Pending");
    expect(statusField.choices.approved).toBe("Approved");
    expect(statusField.choices.rejected).toBe("Rejected");
    expect(statusField.choices.cancelled).toBe("Cancelled");
    expect(statusField.choices.expired).toBe("Expired");
  });

  it("priority filter has All option and all spec priorities", () => {
    const priorityField = op.inputFields.find((f) => f.key === "priority");
    expect(priorityField.choices[""]).toBe("All");
    expect(priorityField.choices.low).toBe("Low");
    expect(priorityField.choices.medium).toBe("Medium");
    expect(priorityField.choices.high).toBe("High");
    expect(priorityField.choices.critical).toBe("Critical");
  });
});
