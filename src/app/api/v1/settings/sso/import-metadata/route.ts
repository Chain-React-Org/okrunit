// ---------------------------------------------------------------------------
// OKrunit -- SSO Metadata Import API
// ---------------------------------------------------------------------------
// POST /api/v1/settings/sso/import-metadata
//
// Fetches a SAML IdP metadata XML from a URL and extracts the entity ID,
// SSO URL, and signing certificate. Returns them for the frontend to
// auto-fill the SSO config form.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { resolveAndCheckUrl } from "@/lib/api/ssrf";

const importSchema = z
  .object({
    metadata_url: z.string().url("Must be a valid URL").optional(),
    metadata_xml: z.string().max(100000).optional(),
  })
  .refine((data) => data.metadata_url || data.metadata_xml, {
    message: "Either metadata_url or metadata_xml must be provided",
  });

/**
 * Naive XML text extraction. Avoids adding a full XML parser dependency.
 * Pulls text content from the first occurrence of a given tag.
 */
function extractTag(xml: string, tag: string): string | null {
  // Handle namespaced tags like md:EntityDescriptor or EntityDescriptor
  const patterns = [
    new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  ];
  for (const re of patterns) {
    const match = xml.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractAttribute(xml: string, tag: string, attr: string): string | null {
  const patterns = [
    new RegExp(`<(?:\\w+:)?${tag}[^>]*?${attr}="([^"]*)"`, "i"),
    new RegExp(`<${tag}[^>]*?${attr}="([^"]*)"`, "i"),
  ];
  for (const re of patterns) {
    const match = xml.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }
    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid URL", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Get the metadata XML, either from direct input or by fetching a URL
    let xml: string;

    if (parsed.data.metadata_xml) {
      xml = parsed.data.metadata_xml;
    } else {
      // SSRF check: prevent fetching from internal networks
      const isPrivate = await resolveAndCheckUrl(parsed.data.metadata_url!);
      if (isPrivate) {
        return NextResponse.json(
          { error: "Metadata URL targets a private or reserved network" },
          { status: 400 },
        );
      }

      const metadataRes = await fetch(parsed.data.metadata_url!, {
        headers: { Accept: "application/xml, text/xml" },
        signal: AbortSignal.timeout(10000),
      });

      if (!metadataRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch metadata: HTTP ${metadataRes.status}` },
          { status: 400 },
        );
      }

      xml = await metadataRes.text();
    }

    if (!xml.includes("EntityDescriptor") && !xml.includes("entityDescriptor")) {
      return NextResponse.json(
        { error: "The URL did not return valid SAML metadata XML" },
        { status: 400 },
      );
    }

    // Extract entity ID
    const entityId =
      extractAttribute(xml, "EntityDescriptor", "entityID") ||
      extractAttribute(xml, "entityDescriptor", "entityID");

    // Extract SSO URL: look for HTTP-Redirect binding first, then HTTP-POST
    let ssoUrl: string | null = null;
    const ssoServicePattern =
      /SingleSignOnService[^>]*Binding="[^"]*(?:Redirect|POST)"[^>]*Location="([^"]*)"/gi;
    let match;
    while ((match = ssoServicePattern.exec(xml)) !== null) {
      if (!ssoUrl) ssoUrl = match[1];
      // Prefer Redirect binding
      if (match[0].includes("Redirect")) {
        ssoUrl = match[1];
        break;
      }
    }

    // Also try Location before Binding order
    if (!ssoUrl) {
      const altPattern =
        /SingleSignOnService[^>]*Location="([^"]*)"[^>]*Binding="[^"]*(?:Redirect|POST)"/gi;
      const altMatch = altPattern.exec(xml);
      if (altMatch) ssoUrl = altMatch[1];
    }

    // Extract signing certificate
    let certificate: string | null = null;
    const certContent = extractTag(xml, "X509Certificate");
    if (certContent) {
      // Clean up whitespace and wrap in PEM headers
      const cleanCert = certContent.replace(/\s+/g, "");
      // Re-format to 64 chars per line
      const lines: string[] = [];
      for (let i = 0; i < cleanCert.length; i += 64) {
        lines.push(cleanCert.substring(i, i + 64));
      }
      certificate = `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
    }

    // Extract SLO URL
    let sloUrl: string | null = null;
    const sloServicePattern =
      /SingleLogoutService[^>]*Binding="[^"]*(?:Redirect|POST)"[^>]*Location="([^"]*)"/gi;
    let sloMatch;
    while ((sloMatch = sloServicePattern.exec(xml)) !== null) {
      if (!sloUrl) sloUrl = sloMatch[1];
      if (sloMatch[0].includes("Redirect")) {
        sloUrl = sloMatch[1];
        break;
      }
    }
    if (!sloUrl) {
      const altSloPattern =
        /SingleLogoutService[^>]*Location="([^"]*)"[^>]*Binding="[^"]*(?:Redirect|POST)"/gi;
      const altSloMatch = altSloPattern.exec(xml);
      if (altSloMatch) sloUrl = altSloMatch[1];
    }

    if (!entityId && !ssoUrl && !certificate) {
      return NextResponse.json(
        { error: "Could not extract any SAML configuration from the metadata" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      entity_id: entityId,
      sso_url: ssoUrl,
      slo_url: sloUrl,
      certificate,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
