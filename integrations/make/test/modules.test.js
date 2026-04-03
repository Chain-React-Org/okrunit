const fs = require('fs');
const path = require('path');

// ── helpers ──────────────────────────────────────────────────────────────────

const MODULES_DIR = path.resolve(__dirname, '..', 'modules');

function loadModule(name) {
  const filePath = path.join(MODULES_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function findParam(mod, paramName) {
  return (mod.parameters || []).find((p) => p.name === paramName);
}

function paramNames(mod) {
  return (mod.parameters || []).map((p) => p.name);
}

function optionValues(param) {
  return (param.options || []).map((o) => o.value);
}

function optionLabels(param) {
  return (param.options || []).map((o) => o.label);
}

// ── Spec-derived constants ───────────────────────────────────────────────────

const SPEC_SAMPLE_NEW_APPROVAL = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Deploy v2.3.1 to production',
  description: 'Release includes new payment flow',
  status: 'pending',
  priority: 'high',
  action_type: 'deploy',
  source: 'api',
  required_approvals: 1,
  current_approvals: 0,
  requested_by_name: 'Jane Smith',
  created_at: '2026-02-21T10:00:00.000Z',
  updated_at: '2026-02-21T10:00:00.000Z',
};

const SPEC_SAMPLE_APPROVAL_DECIDED = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Deploy v2.3.1 to production',
  description: 'Release includes new payment flow',
  status: 'approved',
  priority: 'high',
  source: 'api',
  decided_by: '770e8400-e29b-41d4-a716-446655440002',
  decided_by_name: 'Jane Smith',
  decided_at: '2026-02-21T10:30:00.000Z',
  decision_comment: 'Looks good, approved!',
  created_at: '2026-02-21T10:00:00.000Z',
  updated_at: '2026-02-21T10:30:00.000Z',
};

const SPEC_SAMPLE_REQUEST_APPROVAL = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Deploy v2.3.1 to production',
  description: 'Release includes new payment flow',
  status: 'pending',
  priority: 'medium',
  source: 'make',
  decided_by: null,
  decided_by_name: null,
  decision_comment: null,
  created_at: '2026-02-21T10:00:00.000Z',
  decided_at: null,
};

const SPEC_SAMPLE_ADD_COMMENT = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  approval_id: '550e8400-e29b-41d4-a716-446655440000',
  body: 'Looks good, proceeding with approval.',
  created_by: '770e8400-e29b-41d4-a716-446655440002',
  created_at: '2026-02-21T10:05:00.000Z',
};

const SPEC_SAMPLE_GET_APPROVAL = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Deploy v2.3.1 to production',
  description: 'Release includes new payment flow',
  status: 'approved',
  priority: 'high',
  action_type: 'deploy',
  source: 'api',
  required_approvals: 1,
  current_approvals: 1,
  requested_by_name: 'Jane Smith',
  decided_by: '770e8400-e29b-41d4-a716-446655440002',
  decided_by_name: 'John Doe',
  decided_at: '2026-02-21T10:30:00.000Z',
  decision_comment: 'Looks good, ship it!',
  created_at: '2026-02-21T10:00:00.000Z',
  updated_at: '2026-02-21T10:30:00.000Z',
};

const SPEC_SAMPLE_LIST_APPROVALS = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Deploy v2.3.1 to production',
  description: 'Release includes new payment flow',
  status: 'pending',
  priority: 'high',
  action_type: 'deploy',
  source: 'api',
  required_approvals: 1,
  current_approvals: 0,
  requested_by_name: 'Jane Smith',
  decided_by: null,
  decided_by_name: null,
  decided_at: null,
  decision_comment: null,
  created_at: '2026-02-21T10:00:00.000Z',
  updated_at: '2026-02-21T10:00:00.000Z',
};

const ALL_STATUS_VALUES = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];
const ALL_PRIORITY_VALUES = ['low', 'medium', 'high', 'critical'];

// ── Load all modules ─────────────────────────────────────────────────────────

const newApproval = loadModule('new_approval');
const approvalDecided = loadModule('approval_decided');
const requestApproval = loadModule('request_approval');
const addComment = loadModule('add_comment');
const getApproval = loadModule('get_approval');
const listApprovals = loadModule('list_approvals');
const approvalDecisionReceived = loadModule('approval_decision_received');

// ═════════════════════════════════════════════════════════════════════════════
//  new_approval
// ═════════════════════════════════════════════════════════════════════════════

describe('new_approval', () => {
  test('has correct label and description', () => {
    expect(newApproval.label).toBe('New Approval Request');
    expect(newApproval.description).toMatch(/new approval request/i);
  });

  test('is a polling trigger', () => {
    expect(newApproval.actionType).toBe('trigger');
    expect(newApproval.type).toBe('polling');
  });

  test('endpoint is GET /api/v1/approvals', () => {
    expect(newApproval.url).toBe('/api/v1/approvals');
    expect(newApproval.method).toBe('GET');
  });

  test('has status filter with all spec statuses', () => {
    const param = findParam(newApproval, 'status_filter');
    expect(param).toBeDefined();
    expect(param.type).toBe('select');
    expect(param.required).toBe(false);
    const values = optionValues(param).filter(Boolean);
    ALL_STATUS_VALUES.forEach((s) => {
      expect(values).toContain(s);
    });
  });

  test('has priority filter with all spec priorities', () => {
    const param = findParam(newApproval, 'priority_filter');
    expect(param).toBeDefined();
    expect(param.type).toBe('select');
    expect(param.required).toBe(false);
    const values = optionValues(param).filter(Boolean);
    ALL_PRIORITY_VALUES.forEach((p) => {
      expect(values).toContain(p);
    });
  });

  test('sample data has all required fields with correct types', () => {
    const s = newApproval.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.description).toBe('string');
    expect(typeof s.status).toBe('string');
    expect(typeof s.priority).toBe('string');
    expect(typeof s.action_type).toBe('string');
    expect(typeof s.source).toBe('string');
    expect(typeof s.required_approvals).toBe('number');
    expect(typeof s.current_approvals).toBe('number');
    expect(typeof s.requested_by_name).toBe('string');
    expect(typeof s.created_at).toBe('string');
    expect(typeof s.updated_at).toBe('string');
  });

  test('sample data values match spec exactly', () => {
    expect(newApproval.samples).toEqual(SPEC_SAMPLE_NEW_APPROVAL);
  });

  test('deduplication is by id on created_at descending', () => {
    const t = newApproval.response.trigger;
    expect(t.id).toContain('item.id');
    expect(t.date).toContain('item.created_at');
    expect(t.order).toBe('desc');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  approval_decided
// ═════════════════════════════════════════════════════════════════════════════

describe('approval_decided', () => {
  test('has correct label and description', () => {
    expect(approvalDecided.label).toBe('Approval Decided');
    expect(approvalDecided.description).toMatch(/approved or rejected/i);
  });

  test('is a polling trigger', () => {
    expect(approvalDecided.actionType).toBe('trigger');
    expect(approvalDecided.type).toBe('polling');
  });

  test('endpoint is GET /api/v1/approvals', () => {
    expect(approvalDecided.url).toBe('/api/v1/approvals');
    expect(approvalDecided.method).toBe('GET');
  });

  test('decision filter is named "decision" (not "status_filter")', () => {
    const decision = findParam(approvalDecided, 'decision');
    expect(decision).toBeDefined();
    expect(decision.type).toBe('select');
    expect(decision.label).toBe('Decision Type');

    // Must NOT have a parameter called "status_filter"
    expect(findParam(approvalDecided, 'status_filter')).toBeUndefined();
  });

  test('decision filter has correct options', () => {
    const decision = findParam(approvalDecided, 'decision');
    const labels = optionLabels(decision);
    expect(labels.some((l) => /approved.*rejected/i.test(l) || /any/i.test(l))).toBe(true);
    expect(labels.some((l) => /approved only/i.test(l))).toBe(true);
    expect(labels.some((l) => /rejected only/i.test(l))).toBe(true);
  });

  test('has priority filter with all spec priorities', () => {
    const param = findParam(approvalDecided, 'priority_filter');
    expect(param).toBeDefined();
    expect(param.type).toBe('select');
    const values = optionValues(param).filter(Boolean);
    ALL_PRIORITY_VALUES.forEach((p) => {
      expect(values).toContain(p);
    });
  });

  test('default status query falls back to approved,rejected', () => {
    expect(approvalDecided.qs.status).toContain('approved,rejected');
  });

  test('sample data values match spec exactly', () => {
    expect(approvalDecided.samples).toEqual(SPEC_SAMPLE_APPROVAL_DECIDED);
  });

  test('sample data has all required fields with correct types', () => {
    const s = approvalDecided.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.description).toBe('string');
    expect(typeof s.status).toBe('string');
    expect(typeof s.priority).toBe('string');
    expect(typeof s.source).toBe('string');
    expect(typeof s.decided_by).toBe('string');
    expect(typeof s.decided_by_name).toBe('string');
    expect(typeof s.decided_at).toBe('string');
    expect(typeof s.decision_comment).toBe('string');
    expect(typeof s.created_at).toBe('string');
    expect(typeof s.updated_at).toBe('string');
  });

  test('deduplication is by id on decided_at descending', () => {
    const t = approvalDecided.response.trigger;
    expect(t.id).toContain('item.id');
    expect(t.date).toContain('item.decided_at');
    expect(t.order).toBe('desc');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  request_approval
// ═════════════════════════════════════════════════════════════════════════════

describe('request_approval', () => {
  test('has correct label and description', () => {
    expect(requestApproval.label).toBe('Request Approval');
    expect(requestApproval.description).toMatch(/approval/i);
  });

  test('is a create action', () => {
    expect(requestApproval.actionType).toBe('create');
  });

  test('endpoint is POST /api/v1/approvals', () => {
    expect(requestApproval.url).toBe('/api/v1/approvals');
    expect(requestApproval.method).toBe('POST');
  });

  test('has all required input parameters', () => {
    const names = paramNames(requestApproval);
    expect(names).toContain('title');
    expect(names).toContain('description');
    expect(names).toContain('callback_url');
    expect(names).toContain('metadata');
  });

  test('title parameter is not required (optional with default)', () => {
    const title = findParam(requestApproval, 'title');
    expect(title.required).toBe(false);
  });

  test('callback_url parameter type is url', () => {
    const cb = findParam(requestApproval, 'callback_url');
    expect(cb).toBeDefined();
    expect(cb.type).toBe('url');
  });

  test('source is set to "make" in request body', () => {
    expect(requestApproval.body.source).toBe('make');
  });

  test('idempotency key format matches spec: make-{title}-{timestamp}', () => {
    const key = requestApproval.body.idempotency_key;
    expect(key).toBeDefined();
    // Must start with "make-"
    expect(key.startsWith('make-')).toBe(true);
    // Must contain a title placeholder and a timestamp placeholder
    expect(key).toContain('title');
    expect(key).toContain('timestamp');
  });

  test('request body contains all required fields', () => {
    const body = requestApproval.body;
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('callback_url');
    expect(body).toHaveProperty('metadata');
    expect(body).toHaveProperty('source');
    expect(body).toHaveProperty('idempotency_key');
  });

  test('sample data values match spec exactly', () => {
    expect(requestApproval.samples).toEqual(SPEC_SAMPLE_REQUEST_APPROVAL);
  });

  test('sample data has all required fields with correct types', () => {
    const s = requestApproval.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.description).toBe('string');
    expect(typeof s.status).toBe('string');
    expect(typeof s.priority).toBe('string');
    expect(typeof s.source).toBe('string');
    expect(s.decided_by).toBeNull();
    expect(s.decided_by_name).toBeNull();
    expect(s.decision_comment).toBeNull();
    expect(typeof s.created_at).toBe('string');
    expect(s.decided_at).toBeNull();
  });

  test('sample source is "make"', () => {
    expect(requestApproval.samples.source).toBe('make');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  add_comment
// ═════════════════════════════════════════════════════════════════════════════

describe('add_comment', () => {
  test('has correct label and description', () => {
    expect(addComment.label).toBe('Add Comment');
    expect(addComment.description).toMatch(/comment/i);
  });

  test('is a create action', () => {
    expect(addComment.actionType).toBe('create');
  });

  test('endpoint is POST /api/v1/approvals/{approvalId}/comments', () => {
    expect(addComment.url).toContain('/api/v1/approvals/');
    expect(addComment.url).toContain('/comments');
    expect(addComment.method).toBe('POST');
  });

  test('uses "approval_id" parameter (not "request_id")', () => {
    const param = findParam(addComment, 'approval_id');
    expect(param).toBeDefined();
    expect(param.required).toBe(true);
    expect(param.type).toBe('text');

    // Must NOT have "request_id"
    expect(findParam(addComment, 'request_id')).toBeUndefined();
  });

  test('has required body/comment parameter', () => {
    const param = findParam(addComment, 'body');
    expect(param).toBeDefined();
    expect(param.required).toBe(true);
    expect(param.type).toBe('text');
  });

  test('request body maps body field correctly', () => {
    expect(addComment.body).toHaveProperty('body');
    expect(addComment.body.body).toContain('parameters.body');
  });

  test('sample data has "approval_id" (not "request_id")', () => {
    expect(addComment.samples).toHaveProperty('approval_id');
    expect(addComment.samples).not.toHaveProperty('request_id');
  });

  test('sample data has "created_by" field', () => {
    expect(addComment.samples).toHaveProperty('created_by');
    expect(typeof addComment.samples.created_by).toBe('string');
  });

  test('sample data values match spec exactly', () => {
    expect(addComment.samples).toEqual(SPEC_SAMPLE_ADD_COMMENT);
  });

  test('sample data has all required fields with correct types', () => {
    const s = addComment.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.approval_id).toBe('string');
    expect(typeof s.body).toBe('string');
    expect(typeof s.created_by).toBe('string');
    expect(typeof s.created_at).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  get_approval
// ═════════════════════════════════════════════════════════════════════════════

describe('get_approval', () => {
  test('has correct label and description', () => {
    expect(getApproval.label).toBe('Search approval');
    expect(getApproval.description).toMatch(/approval/i);
  });

  test('is a search action', () => {
    expect(getApproval.actionType).toBe('search');
  });

  test('endpoint is GET /api/v1/approvals/{approvalId}', () => {
    expect(getApproval.url).toContain('/api/v1/approvals/');
    expect(getApproval.url).toContain('approval_id');
    expect(getApproval.method).toBe('GET');
  });

  test('has required approval_id parameter', () => {
    const param = findParam(getApproval, 'approval_id');
    expect(param).toBeDefined();
    expect(param.required).toBe(true);
    expect(param.type).toBe('text');
  });

  test('sample data values match spec exactly', () => {
    expect(getApproval.samples).toEqual(SPEC_SAMPLE_GET_APPROVAL);
  });

  test('sample data has all required fields with correct types', () => {
    const s = getApproval.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.description).toBe('string');
    expect(typeof s.status).toBe('string');
    expect(typeof s.priority).toBe('string');
    expect(typeof s.action_type).toBe('string');
    expect(typeof s.source).toBe('string');
    expect(typeof s.required_approvals).toBe('number');
    expect(typeof s.current_approvals).toBe('number');
    expect(typeof s.requested_by_name).toBe('string');
    expect(typeof s.decided_by).toBe('string');
    expect(typeof s.decided_by_name).toBe('string');
    expect(typeof s.decided_at).toBe('string');
    expect(typeof s.decision_comment).toBe('string');
    expect(typeof s.created_at).toBe('string');
    expect(typeof s.updated_at).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  list_approvals
// ═════════════════════════════════════════════════════════════════════════════

describe('list_approvals', () => {
  test('has correct label and description', () => {
    expect(listApprovals.label).toMatch(/approvals/i);
    expect(listApprovals.description).toMatch(/search|filter/i);
  });

  test('is a search action', () => {
    expect(listApprovals.actionType).toBe('search');
  });

  test('endpoint is GET /api/v1/approvals', () => {
    expect(listApprovals.url).toBe('/api/v1/approvals');
    expect(listApprovals.method).toBe('GET');
  });

  test('has "limit" parameter (not "page_size") with type integer and default 25', () => {
    const limit = findParam(listApprovals, 'limit');
    expect(limit).toBeDefined();
    expect(limit.type).toBe('integer');
    expect(limit.default).toBe(25);
    expect(limit.required).toBe(false);

    // Must NOT have "page_size"
    expect(findParam(listApprovals, 'page_size')).toBeUndefined();
  });

  test('has status filter with all spec statuses', () => {
    const param = findParam(listApprovals, 'status');
    expect(param).toBeDefined();
    expect(param.type).toBe('select');
    expect(param.required).toBe(false);
    const values = optionValues(param).filter(Boolean);
    ALL_STATUS_VALUES.forEach((s) => {
      expect(values).toContain(s);
    });
  });

  test('has priority filter with all spec priorities', () => {
    const param = findParam(listApprovals, 'priority');
    expect(param).toBeDefined();
    expect(param.type).toBe('select');
    expect(param.required).toBe(false);
    const values = optionValues(param).filter(Boolean);
    ALL_PRIORITY_VALUES.forEach((p) => {
      expect(values).toContain(p);
    });
  });

  test('has search text parameter', () => {
    const param = findParam(listApprovals, 'search');
    expect(param).toBeDefined();
    expect(param.type).toBe('text');
    expect(param.required).toBe(false);
  });

  test('query string maps all filter parameters', () => {
    const qs = listApprovals.qs;
    expect(qs).toHaveProperty('status');
    expect(qs).toHaveProperty('priority');
    expect(qs).toHaveProperty('search');
    expect(qs).toHaveProperty('limit');
  });

  test('sample data values match spec exactly', () => {
    expect(listApprovals.samples).toEqual(SPEC_SAMPLE_LIST_APPROVALS);
  });

  test('sample data has all required fields with correct types', () => {
    const s = listApprovals.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(typeof s.description).toBe('string');
    expect(typeof s.status).toBe('string');
    expect(typeof s.priority).toBe('string');
    expect(typeof s.action_type).toBe('string');
    expect(typeof s.source).toBe('string');
    expect(typeof s.required_approvals).toBe('number');
    expect(typeof s.current_approvals).toBe('number');
    expect(typeof s.requested_by_name).toBe('string');
    expect(s.decided_by).toBeNull();
    expect(s.decided_by_name).toBeNull();
    expect(s.decided_at).toBeNull();
    expect(s.decision_comment).toBeNull();
    expect(typeof s.created_at).toBe('string');
    expect(typeof s.updated_at).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  approval_decision_received (instant webhook trigger)
// ═════════════════════════════════════════════════════════════════════════════

describe('approval_decision_received', () => {
  test('has correct label and description', () => {
    expect(approvalDecisionReceived.label).toBe('Approval Decision Received');
    expect(approvalDecisionReceived.description).toMatch(/webhook|decision/i);
  });

  test('is an instant (webhook) trigger', () => {
    expect(approvalDecisionReceived.type).toBe('instant');
    expect(approvalDecisionReceived.webhook).toBeDefined();
  });

  test('has no user-configurable parameters', () => {
    expect(approvalDecisionReceived.parameters).toEqual([]);
  });

  test('response spec includes all callback response fields', () => {
    const specNames = approvalDecisionReceived.response.spec.map((f) => f.name);
    expect(specNames).toContain('id');
    expect(specNames).toContain('title');
    expect(specNames).toContain('status');
    expect(specNames).toContain('priority');
    expect(specNames).toContain('decided_by');
    expect(specNames).toContain('decided_by_name');
    expect(specNames).toContain('decision_comment');
    expect(specNames).toContain('metadata');
    expect(specNames).toContain('decided_at');
  });

  test('sample data has correct fields', () => {
    const s = approvalDecisionReceived.samples;
    expect(typeof s.id).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(['approved', 'rejected']).toContain(s.status);
    expect(typeof s.priority).toBe('string');
    expect(typeof s.decided_by).toBe('string');
    expect(typeof s.decided_by_name).toBe('string');
    expect(typeof s.decided_at).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  Cross-module consistency checks
// ═════════════════════════════════════════════════════════════════════════════

describe('cross-module consistency', () => {
  test('connection is defined in base, not in individual modules', () => {
    const base = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'base.json'), 'utf-8')
    );
    expect(base.connection).toBe('oauth2');

    const modules = [
      newApproval, approvalDecided, requestApproval,
      addComment, getApproval, listApprovals, approvalDecisionReceived,
    ];
    modules.forEach((m) => {
      expect(m.connection).toBeUndefined();
    });
  });

  test('all modules have labels and descriptions', () => {
    const modules = [
      newApproval, approvalDecided, requestApproval,
      addComment, getApproval, listApprovals, approvalDecisionReceived,
    ];
    modules.forEach((m) => {
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
      expect(typeof m.description).toBe('string');
      expect(m.description.length).toBeGreaterThan(0);
    });
  });

  test('all modules have sample data', () => {
    const modules = [
      newApproval, approvalDecided, requestApproval,
      addComment, getApproval, listApprovals, approvalDecisionReceived,
    ];
    modules.forEach((m) => {
      expect(m.samples).toBeDefined();
      expect(typeof m.samples).toBe('object');
      expect(Object.keys(m.samples).length).toBeGreaterThan(0);
    });
  });

  test('all sample IDs are valid UUIDs', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const modules = [
      newApproval, approvalDecided, requestApproval,
      addComment, getApproval, listApprovals, approvalDecisionReceived,
    ];
    modules.forEach((m) => {
      expect(m.samples.id).toMatch(uuidRegex);
    });
  });

  test('all sample timestamps are valid ISO 8601', () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const modules = [
      newApproval, approvalDecided, requestApproval,
      addComment, getApproval, listApprovals, approvalDecisionReceived,
    ];
    modules.forEach((m) => {
      if (m.samples.created_at) {
        expect(m.samples.created_at).toMatch(isoRegex);
      }
      if (m.samples.updated_at) {
        expect(m.samples.updated_at).toMatch(isoRegex);
      }
      if (m.samples.decided_at && m.samples.decided_at !== null) {
        expect(m.samples.decided_at).toMatch(isoRegex);
      }
    });
  });

  test('only request_approval sets source to "make"', () => {
    expect(requestApproval.body.source).toBe('make');
    expect(requestApproval.samples.source).toBe('make');
    // Other modules should not hardcode source in their request body
    expect(newApproval.samples.source).toBe('api');
    expect(approvalDecided.samples.source).toBe('api');
  });

  test('all JSON files are valid JSON', () => {
    const moduleNames = [
      'new_approval', 'approval_decided', 'request_approval',
      'add_comment', 'get_approval', 'list_approvals', 'approval_decision_received',
      'universal',
    ];
    moduleNames.forEach((name) => {
      const filePath = path.join(MODULES_DIR, `${name}.json`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  base.json
// ═════════════════════════════════════════════════════════════════════════════

describe('base', () => {
  const base = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'base.json'), 'utf-8')
  );

  test('has error handling with status code and message', () => {
    expect(base.response).toBeDefined();
    expect(base.response.error).toBeDefined();
    expect(base.response.error.message).toContain('statusCode');
    expect(base.response.error.message).toContain('body.message');
  });

  test('has connection set to oauth2', () => {
    expect(base.connection).toBe('oauth2');
  });

  test('has authorization header', () => {
    expect(base.headers.Authorization).toContain('connection.accessToken');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  universal (Make an API call)
// ═════════════════════════════════════════════════════════════════════════════

describe('universal', () => {
  const universal = loadModule('universal');

  test('has correct label and description', () => {
    expect(universal.label).toBe('Make an API call');
    expect(universal.description).toMatch(/api call/i);
  });

  test('is a universal action type', () => {
    expect(universal.actionType).toBe('universal');
  });

  test('has url, method, headers, qs, and body parameters', () => {
    const names = paramNames(universal);
    expect(names).toContain('url');
    expect(names).toContain('method');
    expect(names).toContain('headers');
    expect(names).toContain('qs');
    expect(names).toContain('body');
  });

  test('url and method are required', () => {
    expect(findParam(universal, 'url').required).toBe(true);
    expect(findParam(universal, 'method').required).toBe(true);
  });

  test('method has standard HTTP options', () => {
    const method = findParam(universal, 'method');
    const values = optionValues(method);
    expect(values).toContain('GET');
    expect(values).toContain('POST');
    expect(values).toContain('PUT');
    expect(values).toContain('PATCH');
    expect(values).toContain('DELETE');
  });

  test('has sample data', () => {
    expect(universal.samples).toBeDefined();
    expect(typeof universal.samples.id).toBe('string');
  });
});
