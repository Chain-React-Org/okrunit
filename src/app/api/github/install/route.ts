// ---------------------------------------------------------------------------
// OKrunit -- GitHub App Installation Callback
//
// After a user installs the OKrunit GitHub App on their org/account, GitHub
// redirects here with installation_id and setup_action query parameters.
// We store the installation linked to the user's current org.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { getInstallationToken } from "@/lib/api/github";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// GET /api/github/install?installation_id=123&setup_action=install
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session auth required (user is in the browser)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Session authentication required for GitHub App installation",
        "SESSION_REQUIRED",
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const installationIdStr = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (!installationIdStr) {
      throw new ApiError(400, "Missing installation_id parameter");
    }

    const installationId = parseInt(installationIdStr, 10);
    if (isNaN(installationId)) {
      throw new ApiError(400, "Invalid installation_id");
    }

    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

    // 3. Handle uninstall action
    if (setupAction === "uninstall") {
      await admin
        .from("github_installations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("installation_id", installationId);

      logAuditEvent({
        orgId: auth.orgId,
        userId: auth.user.id,
        action: "github_installation.removed",
        resourceType: "github_installation",
        details: { installation_id: installationId },
        ipAddress: getClientIp(request),
      });

      return NextResponse.redirect(
        `${appUrl}/settings/integrations?github=uninstalled`,
      );
    }

    // 4. Fetch installation details from GitHub API to get account info
    let accountLogin = "unknown";
    let accountType = "Organization";
    let repositories: string[] = [];

    try {
      const token = await getInstallationToken(installationId);

      // Get the installation details
      const response = await fetch(
        "https://api.github.com/installation/repositories?per_page=100",
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          repositories: Array<{
            full_name: string;
            owner: { login: string; type: string };
          }>;
        };

        if (data.repositories.length > 0) {
          const firstRepo = data.repositories[0];
          accountLogin = firstRepo.owner.login;
          accountType = firstRepo.owner.type;
          repositories = data.repositories.map((r) => r.full_name);
        }
      }
    } catch (fetchError) {
      // Non-fatal: we still store the installation even if we can't fetch details
      logger.error(
        "[GitHub Install] Failed to fetch installation details:",
        fetchError,
      );
    }

    // 5. Upsert the installation record
    const { data: existingInstall } = await admin
      .from("github_installations")
      .select("id")
      .eq("installation_id", installationId)
      .maybeSingle();

    if (existingInstall) {
      // Update existing installation
      await admin
        .from("github_installations")
        .update({
          org_id: auth.orgId,
          account_login: accountLogin,
          account_type: accountType,
          repositories: JSON.stringify(repositories),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingInstall.id);
    } else {
      // Insert new installation
      await admin.from("github_installations").insert({
        org_id: auth.orgId,
        installation_id: installationId,
        account_login: accountLogin,
        account_type: accountType,
        repositories: JSON.stringify(repositories),
        is_active: true,
      });
    }

    // 6. Audit log
    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "github_installation.created",
      resourceType: "github_installation",
      details: {
        installation_id: installationId,
        account_login: accountLogin,
        account_type: accountType,
        repository_count: repositories.length,
      },
      ipAddress: getClientIp(request),
    });

    // 7. Redirect back to the integrations settings page
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?github=installed`,
    );
  } catch (error) {
    // For redirects, we want to show a user-friendly page, not a JSON error
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

    if (error instanceof ApiError && error.statusCode === 401) {
      return NextResponse.redirect(
        `${appUrl}/login?redirect=/settings/integrations`,
      );
    }

    logger.error("[GitHub Install] Error:", error);
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?github=error`,
    );
  }
}
