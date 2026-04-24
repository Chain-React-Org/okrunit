import type { InAppNotification } from "@/lib/types/database";

type HrefInput = Pick<InAppNotification, "resource_type" | "resource_id" | "category">;

export function getNotificationHref(n: HrefInput): string {
  if (n.resource_type === "approval_flow" && n.resource_id) {
    return `/requests/routes?flow=${n.resource_id}`;
  }
  if (n.resource_type === "approval_request" && n.resource_id) {
    return `/requests?open=${n.resource_id}`;
  }
  if (n.resource_type === "team" && n.resource_id) {
    return `/org/teams/${n.resource_id}`;
  }
  if (n.resource_type === "connection") {
    return "/requests/connections";
  }
  if (n.resource_type === "org_invite") {
    return "/org/members";
  }
  if (
    n.resource_type === "approval_delegation" ||
    n.category === "delegation_received" ||
    n.category === "delegation_revoked" ||
    n.category === "delegation_expiring"
  ) {
    return "/settings/delegation";
  }
  if (n.category === "limit_approaching" || n.category === "billing") {
    return "/org/billing";
  }
  if (n.category === "role_changed") {
    return "/settings/account";
  }
  return "/requests";
}
