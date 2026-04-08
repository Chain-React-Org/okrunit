// ---------------------------------------------------------------------------
// OKrunit -- SSRF Protection
// ---------------------------------------------------------------------------
// Functions to validate callback URLs against private/internal networks.
// isPrivateUrl is a sync check for hostname strings.
// resolveAndCheckUrl adds async DNS resolution to catch rebinding attacks.
// ---------------------------------------------------------------------------

import { promises as dnsPromises } from "dns";

/** Block SSRF: reject callback URLs pointing to private/internal networks. */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block obvious private hostnames
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") return true;
    if (hostname === "0.0.0.0" || hostname.endsWith(".local")) return true;
    if (hostname === "metadata.google.internal") return true;

    // Block private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;                          // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
      if (a === 192 && b === 168) return true;            // 192.168.0.0/16
      if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (link-local / cloud metadata)
      if (a === 127) return true;                         // 127.0.0.0/8
      if (a === 0) return true;                           // 0.0.0.0/8
    }

    // Block non-https (allow http for development only)
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;

    return false;
  } catch {
    return true; // Invalid URL = blocked
  }
}

/** Check if a resolved IP address belongs to a private range. */
function isPrivateIp(address: string): boolean {
  // Check IPv4
  const parts = address.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }

  // Check IPv6 private ranges
  if (
    address === "::1" ||
    address.startsWith("fe80:") ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("::ffff:127.") ||
    address.startsWith("::ffff:10.") ||
    address.startsWith("::ffff:192.168.") ||
    address.startsWith("::ffff:169.254.")
  ) {
    return true;
  }

  return false;
}

/**
 * Async SSRF check that resolves DNS before validating.
 * Catches DNS rebinding attacks where a hostname resolves to a private IP.
 * Returns true if the URL should be blocked.
 */
export async function resolveAndCheckUrl(urlString: string): Promise<boolean> {
  // First do the sync check
  if (isPrivateUrl(urlString)) return true;

  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

    // Skip DNS resolution for IP literals (already checked above)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;

    const { address } = await dnsPromises.lookup(hostname);
    return isPrivateIp(address);
  } catch {
    return true; // DNS resolution failure = blocked
  }
}
