// ---------------------------------------------------------------------------
// OKRunit Zapier Integration -- OAuth 2.0 Authentication
// ---------------------------------------------------------------------------
// The OKRUNIT_URL is set via the Zapier Developer Portal environment
// variables. Users do NOT need to enter any URL. They just click "Connect".
// ---------------------------------------------------------------------------

const OKRUNIT_URL =
  process.env.OKRUNIT_URL || "https://www.okrunit.com";

const authentication = {
  type: "oauth2",

  oauth2Config: {
    authorizeUrl: {
      url: `${OKRUNIT_URL}/oauth/authorize`,
      params: {
        client_id: "{{process.env.CLIENT_ID}}",
        redirect_uri: "{{bundle.inputData.redirect_uri}}",
        response_type: "code",
        scope: "approvals:read approvals:write comments:write",
        state: "{{bundle.inputData.state}}",
      },
    },

    getAccessToken: async (z, bundle) => {
      const body = {
        code: bundle.inputData.code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: bundle.inputData.redirect_uri,
        grant_type: "authorization_code",
      };

      // PKCE: Zapier puts code_verifier in bundle.inputData when enablePkce is true.
      if (bundle.inputData.code_verifier) {
        body.code_verifier = bundle.inputData.code_verifier;
      }

      const response = await z.request({
        url: `${OKRUNIT_URL}/api/v1/oauth/token`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      return response.json;
    },

    refreshAccessToken: {
      url: `${OKRUNIT_URL}/api/v1/oauth/token`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        refresh_token: "{{bundle.authData.refresh_token}}",
        client_id: "{{process.env.CLIENT_ID}}",
        client_secret: "{{process.env.CLIENT_SECRET}}",
        grant_type: "refresh_token",
      },
    },

    autoRefresh: true,
    enablePkce: true,

    scope: "approvals:read approvals:write comments:write",
  },

  // No pre-auth fields. Users just click "Connect" and authorize.
  fields: [],

  test: async (z, bundle) => {
    const response = await z.request({
      url: `${OKRUNIT_URL}/api/v1/approvals`,
      params: { page_size: 1 },
    });
    return {
      id: bundle.authData.user_email || bundle.authData.org_name || "connected",
    };
  },

  connectionLabel: (z, bundle) => {
    if (bundle.authData.org_name) {
      return `OKRunit (${bundle.authData.org_name})`;
    }
    return "OKRunit";
  },
};

// Middleware: inject OAuth access token on every request.
const addAuthHeader = (request, z, bundle) => {
  if (bundle.authData.access_token) {
    request.headers["Authorization"] = `Bearer ${bundle.authData.access_token}`;
  }
  request.headers["Content-Type"] = "application/json";
  return request;
};

// Middleware: handle API errors.
const handleErrors = (response, z) => {
  if (response.status === 401) {
    throw new z.errors.RefreshAuthError("Token expired or invalid");
  }
  if (response.status === 429) {
    throw new z.errors.ThrottledError("Rate limit exceeded", 60);
  }
  if (response.status >= 400) {
    const body = response.json;
    const message = body.error || body.error_description || `API error: ${response.status}`;
    const err = new z.errors.Error(
      message,
      body.code || "API_ERROR",
      response.status,
    );
    err.status = response.status;
    throw err;
  }
  return response;
};

module.exports = { authentication, addAuthHeader, handleErrors, OKRUNIT_URL };
