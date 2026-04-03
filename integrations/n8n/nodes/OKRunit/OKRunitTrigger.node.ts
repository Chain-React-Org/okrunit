import type {
  IDataObject,
  IPollFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

interface ApprovalRecord {
  id: string;
  created_at: string;
  decided_at: string | null;
  [key: string]: unknown;
}

export class OKRunitTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "OKRunit Trigger",
    name: "okrunitTrigger",
    icon: "file:okrunit.svg",
    group: ["trigger"],
    version: 1,
    description: "Fires when approvals are created or decided in OKRunit",
    defaults: { name: "OKRunit Trigger" },
    inputs: [],
    outputs: ["main"],
    polling: true,
    credentials: [{ name: "okrunitOAuth2Api", required: true }],
    properties: [
      {
        displayName: "Trigger Type",
        name: "triggerType",
        type: "options",
        options: [
          {
            name: "New Approval Request",
            value: "newApproval",
            description: "Fires when a new approval request is created",
          },
          {
            name: "Approval Decided",
            value: "approvalDecided",
            description:
              "Fires when an approval is approved or rejected",
          },
        ],
        default: "approvalDecided",
        description: "Which event to trigger on",
      },

      // ── newApproval filters ────────────────────────────────────────
      {
        displayName: "Status Filter",
        name: "newApprovalStatus",
        type: "options",
        displayOptions: { show: { triggerType: ["newApproval"] } },
        options: [
          { name: "Any", value: "" },
          { name: "Pending", value: "pending" },
          { name: "Approved", value: "approved" },
          { name: "Rejected", value: "rejected" },
          { name: "Cancelled", value: "cancelled" },
          { name: "Expired", value: "expired" },
        ],
        default: "",
        description: "Only trigger for approvals with this status",
      },
      {
        displayName: "Priority Filter",
        name: "newApprovalPriority",
        type: "options",
        displayOptions: { show: { triggerType: ["newApproval"] } },
        options: [
          { name: "Any", value: "" },
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
          { name: "Critical", value: "critical" },
        ],
        default: "",
        description: "Only trigger for approvals with this priority",
      },

      // ── approvalDecided filters ────────────────────────────────────
      {
        displayName: "Decision Filter",
        name: "statusFilter",
        type: "options",
        displayOptions: { show: { triggerType: ["approvalDecided"] } },
        options: [
          { name: "Approved or Rejected", value: "any" },
          { name: "Approved Only", value: "approved" },
          { name: "Rejected Only", value: "rejected" },
        ],
        default: "any",
        description: "Filter to only trigger on specific decision types",
      },
      {
        displayName: "Priority Filter",
        name: "priorityFilter",
        type: "options",
        displayOptions: { show: { triggerType: ["approvalDecided"] } },
        options: [
          { name: "Any", value: "" },
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
          { name: "Critical", value: "critical" },
        ],
        default: "",
        description: "Only trigger for approvals with this priority",
      },
    ],
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const credentials = await this.getCredentials("okrunitOAuth2Api");
    const baseUrl = credentials.baseUrl as string;
    const triggerType = this.getNodeParameter("triggerType") as string;

    const webhookData = this.getWorkflowStaticData("node");
    const lastPollTime = webhookData.lastPollTime as string | undefined;
    webhookData.lastPollTime = new Date().toISOString();

    const results: INodeExecutionData[] = [];

    if (triggerType === "newApproval") {
      // ── New Approval trigger ─────────────────────────────────────
      const statusFilter = this.getNodeParameter(
        "newApprovalStatus",
      ) as string;
      const priorityFilter = this.getNodeParameter(
        "newApprovalPriority",
      ) as string;

      const qs: Record<string, string> = { page_size: "50" };
      if (statusFilter) qs.status = statusFilter;
      if (priorityFilter) qs.priority = priorityFilter;

      const response =
        (await this.helpers.httpRequestWithAuthentication.call(
          this,
          "okrunitOAuth2Api",
          {
            method: "GET",
            url: `${baseUrl}/api/v1/approvals`,
            json: true,
            qs,
          },
        )) as { data?: ApprovalRecord[] };

      const approvals: ApprovalRecord[] = response.data ?? [];

      for (const approval of approvals) {
        if (lastPollTime && approval.created_at > lastPollTime) {
          results.push({ json: approval as unknown as IDataObject });
        } else if (!lastPollTime) {
          results.push({ json: approval as unknown as IDataObject });
        }
      }
    } else {
      // ── Approval Decided trigger ─────────────────────────────────
      const statusFilter = this.getNodeParameter("statusFilter") as string;
      const priorityFilter = this.getNodeParameter(
        "priorityFilter",
      ) as string;

      const statuses =
        statusFilter === "any" ? ["approved", "rejected"] : [statusFilter];

      for (const status of statuses) {
        const qs: Record<string, string> = { status, page_size: "50" };
        if (priorityFilter) qs.priority = priorityFilter;

        const response =
          (await this.helpers.httpRequestWithAuthentication.call(
            this,
            "okrunitOAuth2Api",
            {
              method: "GET",
              url: `${baseUrl}/api/v1/approvals`,
              json: true,
              qs,
            },
          )) as { data?: ApprovalRecord[] };

        const approvals: ApprovalRecord[] = response.data ?? [];

        for (const approval of approvals) {
          if (
            lastPollTime &&
            approval.decided_at &&
            approval.decided_at > lastPollTime
          ) {
            results.push({ json: approval as unknown as IDataObject });
          } else if (!lastPollTime && approval.decided_at) {
            results.push({ json: approval as unknown as IDataObject });
          }
        }
      }
    }

    if (results.length === 0) return null;
    return [results];
  }
}
