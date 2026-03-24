"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck, ShieldX, Loader2, Save, CheckCircle2 } from "lucide-react";

interface SSOConfigData {
  id: string;
  provider: string;
  entity_id: string;
  sso_url: string;
  certificate_preview: string;
  attribute_mapping: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SSOConfigFormProps {
  orgId: string;
}

export function SSOConfigForm({ orgId }: SSOConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [existingConfig, setExistingConfig] = useState<SSOConfigData | null>(null);

  // Form state
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [attrEmail, setAttrEmail] = useState("email");
  const [attrFirstName, setAttrFirstName] = useState("firstName");
  const [attrLastName, setAttrLastName] = useState("lastName");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/settings/sso");
      const data = await res.json();

      if (data.configured && data.config) {
        setExistingConfig(data.config);
        setEntityId(data.config.entity_id);
        setSsoUrl(data.config.sso_url);
        setIsActive(data.config.is_active);
        if (data.config.attribute_mapping) {
          setAttrEmail(data.config.attribute_mapping.email || "email");
          setAttrFirstName(data.config.attribute_mapping.firstName || "firstName");
          setAttrLastName(data.config.attribute_mapping.lastName || "lastName");
        }
      }
    } catch {
      setError("Failed to load SSO configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    try {
      const res = await fetch("/api/v1/settings/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: entityId,
          sso_url: ssoUrl,
          certificate,
          is_active: isActive,
          attribute_mapping: {
            email: attrEmail,
            firstName: attrFirstName,
            lastName: attrLastName,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          setFieldErrors(data.details);
        }
        setError(data.error || "Failed to save SSO configuration");
        return;
      }

      setExistingConfig(data.config);
      setSaved(true);
      // Clear certificate field after save (security)
      setCertificate("");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save SSO configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-card p-12 shadow-[var(--shadow-card)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading SSO configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-4">
          <div className={`rounded-lg p-2.5 ${existingConfig?.is_active ? "bg-green-500/10" : "bg-muted/50"}`}>
            {existingConfig?.is_active ? (
              <ShieldCheck className="size-6 text-green-600" />
            ) : (
              <ShieldX className="size-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-medium">
              SSO Status: {existingConfig?.is_active ? (
                <span className="text-green-600">Active</span>
              ) : existingConfig ? (
                <span className="text-amber-600">Configured (Inactive)</span>
              ) : (
                <span className="text-muted-foreground">Not Configured</span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {existingConfig?.is_active
                ? "Team members can sign in using your identity provider."
                : existingConfig
                  ? "SSO is configured but not active. Enable it below to allow SSO sign-in."
                  : "Configure SAML SSO to allow team members to sign in with your identity provider."}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="size-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">SAML Configuration</h3>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Entity ID */}
          <div>
            <label htmlFor="entity-id" className="mb-1.5 block text-sm font-medium">
              Entity ID (Issuer)
            </label>
            <input
              id="entity-id"
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="https://idp.example.com/saml/metadata"
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
            {fieldErrors.entity_id && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.entity_id[0]}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              The unique identifier for your identity provider. Also called Issuer URL.
            </p>
          </div>

          {/* SSO URL */}
          <div>
            <label htmlFor="sso-url" className="mb-1.5 block text-sm font-medium">
              SSO URL (Sign-in Endpoint)
            </label>
            <input
              id="sso-url"
              type="url"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              placeholder="https://idp.example.com/saml/sso"
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
            {fieldErrors.sso_url && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.sso_url[0]}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              The URL where users are redirected to authenticate with your identity provider.
            </p>
          </div>

          {/* Certificate */}
          <div>
            <label htmlFor="certificate" className="mb-1.5 block text-sm font-medium">
              X.509 Certificate (PEM)
            </label>
            <textarea
              id="certificate"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"}
              rows={6}
              className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required={!existingConfig}
            />
            {fieldErrors.certificate && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.certificate[0]}</p>
            )}
            {existingConfig && !certificate && (
              <p className="mt-1 text-xs text-amber-600">
                Certificate on file (preview: {existingConfig.certificate_preview}). Paste a new certificate to replace it, or leave blank to keep the current one.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              The public X.509 certificate from your identity provider in PEM format.
            </p>
          </div>

          {/* Attribute mapping */}
          <div>
            <h4 className="mb-3 text-sm font-medium">Attribute Mapping</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Map SAML attributes from your IdP to OKRunit user fields.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="attr-email" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Email Attribute
                </label>
                <input
                  id="attr-email"
                  type="text"
                  value={attrEmail}
                  onChange={(e) => setAttrEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="attr-first" className="mb-1 block text-xs font-medium text-muted-foreground">
                  First Name Attribute
                </label>
                <input
                  id="attr-first"
                  type="text"
                  value={attrFirstName}
                  onChange={(e) => setAttrFirstName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="attr-last" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Last Name Attribute
                </label>
                <input
                  id="attr-last"
                  type="text"
                  value={attrLastName}
                  onChange={(e) => setAttrLastName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-muted/30 p-4">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                isActive ? "bg-green-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                  isActive ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-medium">Enable SSO</p>
              <p className="text-xs text-muted-foreground">
                When enabled, team members can sign in using your identity provider.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Configuration"}
          </button>

          {saved && (
            <span className="text-sm text-green-600">Configuration saved successfully.</span>
          )}
        </div>
      </form>

      {/* Service Provider info */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <h3 className="mb-3 text-sm font-semibold">Service Provider Details</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Provide these values to your identity provider when configuring the SAML integration.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ACS URL (Assertion Consumer Service)</label>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/saml/callback
            </code>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Entity ID / Audience URI</label>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/saml/metadata
            </code>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name ID Format</label>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
