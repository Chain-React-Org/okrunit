import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class OKRunitApi implements ICredentialType {
  name = "okrunitApi";
  displayName = "OKRunit API";
  documentationUrl = "https://okrunit.com/docs/integrations/n8n";

  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      placeholder: "ok_...",
      description: "Your OKRunit API key (starts with ok_)",
    },
    {
      displayName: "Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://okrunit.com",
      placeholder: "https://okrunit.com",
      description: "The base URL of your OKRunit instance",
    },
  ];

  authenticate = {
    type: "generic" as const,
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.apiKey}}",
      },
    },
  };

  test = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/approvals",
      qs: { page_size: "1" },
    },
  };
}
