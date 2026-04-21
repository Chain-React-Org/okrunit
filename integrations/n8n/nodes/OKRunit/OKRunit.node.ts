import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

export class OKRunit implements INodeType {
  description: INodeTypeDescription = {
    displayName: "OKRunit",
    name: "okrunit",
    icon: "file:okrunit.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Human-in-the-loop approval gateway",
    defaults: { name: "OKRunit" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "okrunitOAuth2Api",
        required: true,
      },
    ],
    properties: [
      // ── Resource selector ──────────────────────────────────────────
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Approval", value: "approval" },
          { name: "Comment", value: "comment" },
        ],
        default: "approval",
      },

      // ── Approval operations ────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["approval"] } },
        options: [
          {
            name: "Create",
            value: "create",
            action: "Create an approval request",
          },
          {
            name: "Get",
            value: "get",
            action: "Get an approval request",
          },
          {
            name: "List",
            value: "list",
            action: "List approval requests",
          },
        ],
        default: "create",
      },

      // ── Comment operations ─────────────────────────────────────────
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["comment"] } },
        options: [
          {
            name: "Add",
            value: "add",
            action: "Add a comment to an approval",
          },
          {
            name: "List",
            value: "list",
            action: "List comments on an approval",
          },
        ],
        default: "add",
      },

      // ── Create Approval fields ─────────────────────────────────────
      {
        displayName: "Title",
        name: "title",
        type: "string",
        required: false,
        displayOptions: {
          show: { resource: ["approval"], operation: ["create"] },
        },
        default: "",
        description:
          'Short title for the approval request (max 500 chars). Defaults to "Approval request from n8n" if blank.',
      },
      {
        displayName: "Priority",
        name: "priority",
        type: "options",
        required: true,
        displayOptions: {
          show: { resource: ["approval"], operation: ["create"] },
        },
        options: [
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
          { name: "Critical", value: "critical" },
        ],
        default: "medium",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: {
          show: { resource: ["approval"], operation: ["create"] },
        },
        options: [
          {
            displayName: "Description",
            name: "description",
            type: "string",
            default: "",
            description: "Detailed description (max 5000 chars)",
          },
          {
            displayName: "Action Type",
            name: "action_type",
            type: "string",
            default: "",
            description:
              'Category of the action (e.g., "deploy", "delete")',
          },
          {
            displayName: "Callback URL",
            name: "callback_url",
            type: "string",
            default: "",
            description: "Webhook URL to receive the decision (must be a valid URL)",
            placeholder: "https://example.com/webhook",
            typeOptions: {
              validationRule: "url",
            },
          },
          {
            displayName: "Metadata (JSON)",
            name: "metadata",
            type: "json",
            default: "{}",
            description: "Arbitrary JSON key-value pairs for context",
          },
          {
            displayName: "Expires At",
            name: "expires_at",
            type: "dateTime",
            default: "",
            description: "ISO 8601 datetime when request auto-expires",
          },
          {
            displayName: "Required Approvals",
            name: "required_approvals",
            type: "number",
            default: 1,
            description: "Number of approvals needed (1-10)",
            typeOptions: { minValue: 1, maxValue: 10 },
          },
          {
            displayName: "Context HTML",
            name: "context_html",
            type: "string",
            default: "",
            description: "Rich HTML displayed to approvers",
          },
        ],
      },

      // ── Get Approval fields ────────────────────────────────────────
      {
        displayName: "Approval ID",
        name: "approvalId",
        type: "string",
        required: true,
        displayOptions: {
          show: { resource: ["approval"], operation: ["get"] },
        },
        default: "",
        description: "The UUID of the approval request",
      },

      // ── List Approvals filters ─────────────────────────────────────
      {
        displayName: "Filters",
        name: "filters",
        type: "collection",
        placeholder: "Add Filter",
        default: {},
        displayOptions: {
          show: { resource: ["approval"], operation: ["list"] },
        },
        options: [
          {
            displayName: "Status",
            name: "status",
            type: "options",
            options: [
              { name: "Pending", value: "pending" },
              { name: "Approved", value: "approved" },
              { name: "Rejected", value: "rejected" },
              { name: "Cancelled", value: "cancelled" },
              { name: "Expired", value: "expired" },
            ],
            default: "",
          },
          {
            displayName: "Priority",
            name: "priority",
            type: "options",
            options: [
              { name: "Low", value: "low" },
              { name: "Medium", value: "medium" },
              { name: "High", value: "high" },
              { name: "Critical", value: "critical" },
            ],
            default: "",
          },
          {
            displayName: "Search",
            name: "search",
            type: "string",
            default: "",
            description: "Full-text search on title/description",
          },
          {
            displayName: "Limit",
            name: "limit",
            type: "number",
            default: 25,
            description: "Maximum number of results",
            typeOptions: { minValue: 1, maxValue: 100 },
          },
        ],
      },

      // ── Comment fields ─────────────────────────────────────────────
      {
        displayName: "Approval ID",
        name: "commentApprovalId",
        type: "string",
        required: true,
        displayOptions: { show: { resource: ["comment"] } },
        default: "",
        description: "The UUID of the approval to comment on",
      },
      {
        displayName: "Comment Body",
        name: "body",
        type: "string",
        required: true,
        displayOptions: {
          show: { resource: ["comment"], operation: ["add"] },
        },
        default: "",
        description: "The comment text (max 5000 chars)",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;
    const credentials = await this.getCredentials("okrunitOAuth2Api");
    const baseUrl = credentials.baseUrl as string;

    for (let i = 0; i < items.length; i++) {
      let responseData: unknown;

      if (resource === "approval") {
        if (operation === "create") {
          const title = this.getNodeParameter("title", i) as string;
          const priority = this.getNodeParameter("priority", i) as string;
          const additionalFields = this.getNodeParameter(
            "additionalFields",
            i,
          ) as Record<string, unknown>;

          // Auto-set source, source_id, and idempotency key per spec.
          // source_id groups requests from the same workflow into a Route,
          // so admins can configure defaults (approvers, priority, etc.) per
          // workflow without hand-editing every incoming request.
          const idempotencyKey = `n8n-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          const workflow = this.getWorkflow();

          const body: Record<string, unknown> = {
            title: title || "Approval request from n8n",
            priority,
            source: "n8n",
            idempotency_key: idempotencyKey,
          };

          if (workflow?.id) body.source_id = String(workflow.id);
          if (workflow?.name) body.source_name = workflow.name;

          for (const [key, value] of Object.entries(additionalFields)) {
            if (value === "" || value === undefined || value === null) continue;

            if (key === "metadata" && typeof value === "string") {
              body[key] = JSON.parse(value);
            } else {
              body[key] = value;
            }
          }

          responseData =
            await this.helpers.httpRequestWithAuthentication.call(
              this,
              "okrunitOAuth2Api",
              {
                method: "POST",
                url: `${baseUrl}/api/v1/approvals`,
                json: true,
                body,
              },
            );
        } else if (operation === "get") {
          const approvalId = this.getNodeParameter(
            "approvalId",
            i,
          ) as string;

          responseData =
            await this.helpers.httpRequestWithAuthentication.call(
              this,
              "okrunitOAuth2Api",
              {
                method: "GET",
                url: `${baseUrl}/api/v1/approvals/${approvalId}`,
                json: true,
              },
            );
        } else if (operation === "list") {
          const filters = this.getNodeParameter("filters", i) as Record<
            string,
            unknown
          >;
          const qs: Record<string, string> = {};

          for (const [k, v] of Object.entries(filters)) {
            if (v !== "" && v !== undefined && v !== null) {
              if (k === "limit") {
                qs.page_size = String(v);
              } else {
                qs[k] = String(v);
              }
            }
          }

          responseData =
            await this.helpers.httpRequestWithAuthentication.call(
              this,
              "okrunitOAuth2Api",
              {
                method: "GET",
                url: `${baseUrl}/api/v1/approvals`,
                json: true,
                qs,
              },
            );
        }
      } else if (resource === "comment") {
        const approvalId = this.getNodeParameter(
          "commentApprovalId",
          i,
        ) as string;

        if (operation === "add") {
          const body = this.getNodeParameter("body", i) as string;

          responseData =
            await this.helpers.httpRequestWithAuthentication.call(
              this,
              "okrunitOAuth2Api",
              {
                method: "POST",
                url: `${baseUrl}/api/v1/approvals/${approvalId}/comments`,
                json: true,
                body: { body },
              },
            );
        } else if (operation === "list") {
          responseData =
            await this.helpers.httpRequestWithAuthentication.call(
              this,
              "okrunitOAuth2Api",
              {
                method: "GET",
                url: `${baseUrl}/api/v1/approvals/${approvalId}/comments`,
                json: true,
              },
            );
        }
      }

      returnData.push({
        json: responseData as IDataObject,
      });
    }

    return [returnData];
  }
}
