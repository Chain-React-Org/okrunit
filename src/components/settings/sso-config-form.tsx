"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  Save,
  CheckCircle2,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Download,
  Zap,
  Upload,
  Lock,
  KeyRound,
} from "lucide-react";

interface SSOConfigData {
  id: string;
  provider: string;
  entity_id: string;
  sso_url: string;
  sso_domain: string | null;
  certificate_preview: string;
  certificate_secondary_preview: string | null;
  attribute_mapping: Record<string, string>;
  is_active: boolean;
  enforce_sso: boolean;
  slo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SSOConfigFormProps {
  orgId: string;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      title={`Copy ${label || "value"}`}
    >
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function SSOConfigForm({ orgId }: SSOConfigFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [existingConfig, setExistingConfig] = useState<SSOConfigData | null>(null);

  // Metadata import
  const [metadataUrl, setMetadataUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importMode, setImportMode] = useState<"url" | "file">("url");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test connection
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Form state
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [certificateSecondary, setCertificateSecondary] = useState("");
  const [ssoDomain, setSsoDomain] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [enforceSso, setEnforceSso] = useState(false);
  const [sloUrl, setSloUrl] = useState("");
  const [attrEmail, setAttrEmail] = useState("email");
  const [attrFirstName, setAttrFirstName] = useState("firstName");
  const [attrLastName, setAttrLastName] = useState("lastName");

  // Advanced section visibility
  const [showAdvanced, setShowAdvanced] = useState(false);
  // After import, show the domain prompt
  const [showDomainPrompt, setShowDomainPrompt] = useState(false);
  const domainInputRef = useRef<HTMLInputElement>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/settings/sso");
      const data = await res.json();

      if (data.configured && data.config) {
        setExistingConfig(data.config);
        setEntityId(data.config.entity_id);
        setSsoUrl(data.config.sso_url);
        setSsoDomain(data.config.sso_domain || "");
        setIsActive(data.config.is_active);
        setEnforceSso(data.config.enforce_sso ?? false);
        setSloUrl(data.config.slo_url || "");
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

  // Save helper. Used by both manual save and auto-save after import
  async function saveConfig(overrides?: {
    entityId?: string;
    ssoUrl?: string;
    certificate?: string;
    sloUrl?: string;
    ssoDomain?: string;
    isActive?: boolean;
  }) {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    try {
      const res = await fetch("/api/v1/settings/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_id: overrides?.entityId ?? entityId,
          sso_url: overrides?.ssoUrl ?? ssoUrl,
          certificate: overrides?.certificate ?? certificate,
          certificate_secondary: certificateSecondary,
          sso_domain: overrides?.ssoDomain ?? ssoDomain,
          is_active: overrides?.isActive ?? isActive,
          enforce_sso: enforceSso,
          slo_url: (overrides?.sloUrl ?? sloUrl) || null,
          attribute_mapping: {
            email: attrEmail,
            firstName: attrFirstName,
            lastName: attrLastName,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) setFieldErrors(data.details);
        setError(data.error || "Failed to save SSO configuration");
        return false;
      }

      setExistingConfig(data.config);
      setSaved(true);
      setCertificate("");
      setCertificateSecondary("");
      setTimeout(() => setSaved(false), 3000);
      return true;
    } catch {
      setError("Failed to save SSO configuration");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Import IdP metadata
  async function handleImportMetadata() {
    if (importMode === "url" && !metadataUrl.trim()) return;

    setImporting(true);
    setError(null);
    setImportSuccess(false);

    try {
      const res = await fetch("/api/v1/settings/sso/import-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          importMode === "url"
            ? { metadata_url: metadataUrl.trim() }
            : { metadata_xml: metadataUrl },
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to import metadata");
        return;
      }

      // Auto-fill form fields
      const newEntityId = data.entity_id || entityId;
      const newSsoUrl = data.sso_url || ssoUrl;
      const newCert = data.certificate || certificate;
      const newSloUrl = data.slo_url || sloUrl;

      setEntityId(newEntityId);
      setSsoUrl(newSsoUrl);
      if (data.certificate) setCertificate(data.certificate);
      if (data.slo_url) setSloUrl(data.slo_url);

      setImportSuccess(true);

      // If domain is already set (editing existing config), auto-save immediately
      if (ssoDomain) {
        await saveConfig({
          entityId: newEntityId,
          ssoUrl: newSsoUrl,
          certificate: newCert,
          sloUrl: newSloUrl,
        });
      } else {
        // First-time setup. Prompt for domain
        setShowDomainPrompt(true);
        setTimeout(() => domainInputRef.current?.focus(), 100);
      }
    } catch {
      setError("Failed to import metadata. Check the input and try again.");
    } finally {
      setImporting(false);
    }
  }

  // Save after entering domain in the quick setup flow
  async function handleDomainSave() {
    if (!ssoDomain.trim()) return;
    const success = await saveConfig({ isActive: true });
    if (success) {
      setShowDomainPrompt(false);
      setIsActive(true);
    }
  }

  // Handle XML file upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const xml = event.target?.result as string;
      if (xml) {
        setMetadataUrl(xml);
        setImportMode("file");
      }
    };
    reader.readAsText(file);
  }

  // Test SSO connection
  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/v1/settings/sso/test", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveConfig();
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
      {/* 1. Status card */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
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

          {existingConfig && (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : testResult?.success ? (
                <CheckCircle2 className="size-4 text-green-600" />
              ) : testResult && !testResult.success ? (
                <ShieldX className="size-4 text-red-500" />
              ) : (
                <Zap className="size-4" />
              )}
              {testing ? "Testing..." : "Test Connection"}
            </button>
          )}
        </div>

        {testResult && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            testResult.success
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
          }`}>
            {testResult.success
              ? "Connection successful! Your SAML configuration is valid and can generate authentication requests."
              : `Connection failed: ${testResult.error || "Unknown error"}`}
          </div>
        )}
      </div>

      {/* 2. Service Provider Details - shown FIRST so admin can configure their IdP */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              {!existingConfig && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Step 1</span>}
              Service Provider Details
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {!existingConfig
                ? "Start here: copy these values into your identity provider (Okta, Azure AD, Google Workspace, etc.)."
                : "Provide these values to your identity provider when configuring the SAML integration."}
            </p>
          </div>
          <a
            href="/api/auth/saml/metadata"
            download="okrunit-sp-metadata.xml"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Download className="size-3.5" />
            Download SP Metadata
          </a>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">ACS URL (Assertion Consumer Service)</label>
              <CopyButton value={`${appUrl}/api/auth/saml/callback`} label="ACS URL" />
            </div>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {appUrl}/api/auth/saml/callback
            </code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Entity ID / Audience URI</label>
              <CopyButton value={`${appUrl}/api/auth/saml/metadata`} label="Entity ID" />
            </div>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {appUrl}/api/auth/saml/metadata
            </code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Single Logout URL</label>
              <CopyButton value={`${appUrl}/api/auth/saml/logout`} label="SLO URL" />
            </div>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {appUrl}/api/auth/saml/logout
            </code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Name ID Format</label>
              <CopyButton value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" label="Name ID Format" />
            </div>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
            </code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">SP Metadata URL</label>
              <CopyButton value={`${appUrl}/api/auth/saml/metadata`} label="Metadata URL" />
            </div>
            <code className="block rounded-md border border-[var(--border)] bg-muted/30 px-3 py-2 text-xs">
              {appUrl}/api/auth/saml/metadata
            </code>
          </div>
        </div>
      </div>

      {/* 3. Import IdP metadata */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center gap-3">
          <LinkIcon className="size-5 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">
              {!existingConfig && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Step 2</span>}
              Import IdP Metadata
            </h3>
            <p className="text-sm text-muted-foreground">
              Paste your identity provider&apos;s metadata URL or upload the XML file.
              This auto-fills everything: Entity ID, SSO URL, SLO URL, and certificate.
            </p>
          </div>
        </div>

        {/* Import mode tabs */}
        <div className="mb-3 flex gap-1 rounded-lg border border-[var(--border)] bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => { setImportMode("url"); setMetadataUrl(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              importMode === "url"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkIcon className="mr-1.5 inline size-3.5" />
            Metadata URL
          </button>
          <button
            type="button"
            onClick={() => { setImportMode("file"); setMetadataUrl(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              importMode === "file"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="mr-1.5 inline size-3.5" />
            Upload XML
          </button>
        </div>

        {importMode === "url" ? (
          <div className="flex gap-3">
            <input
              type="url"
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
              placeholder="https://your-idp.com/app/metadata"
              className="flex-1 rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleImportMetadata}
              disabled={importing || !metadataUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : importSuccess ? (
                <CheckCircle2 className="size-4" />
              ) : null}
              {importing ? "Importing..." : importSuccess ? "Imported!" : "Import"}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-muted/20 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <Upload className="size-4" />
                {metadataUrl ? "File loaded, click Import" : "Choose XML metadata file"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleImportMetadata}
              disabled={importing || !metadataUrl}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : importSuccess ? (
                <CheckCircle2 className="size-4" />
              ) : null}
              {importing ? "Importing..." : importSuccess ? "Imported!" : "Import"}
            </button>
          </div>
        )}

        {/* Domain prompt after first-time import */}
        {showDomainPrompt && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
            <p className="mb-3 text-sm font-medium text-green-800 dark:text-green-300">
              <CheckCircle2 className="mr-1.5 inline size-4" />
              IdP configuration imported. Enter your email domain to finish setup.
            </p>
            <div className="flex gap-3">
              <input
                ref={domainInputRef}
                type="text"
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value.toLowerCase())}
                placeholder="company.com"
                className="flex-1 rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDomainSave();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleDomainSave}
                disabled={saving || !ssoDomain.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {saving ? "Saving..." : "Enable SSO"}
              </button>
            </div>
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">
              Users with @{ssoDomain || "company.com"} emails will be able to sign in via SSO.
            </p>
          </div>
        )}

        {/* Success message for import-then-auto-save */}
        {importSuccess && !showDomainPrompt && (
          <p className="mt-3 text-sm text-green-600">
            <CheckCircle2 className="mr-1.5 inline size-4" />
            Configuration imported and saved.
          </p>
        )}
      </div>

      {/* 4. Configuration form - for manual entry or editing */}
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
          {/* Email domain */}
          <div>
            <label htmlFor="sso-domain" className="mb-1.5 block text-sm font-medium">
              Email Domain
            </label>
            <input
              id="sso-domain"
              type="text"
              value={ssoDomain}
              onChange={(e) => setSsoDomain(e.target.value.toLowerCase())}
              placeholder="company.com"
              className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              required
            />
            {fieldErrors.sso_domain && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.sso_domain[0]}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Users with @{ssoDomain || "company.com"} emails will be able to sign in via SSO.
            </p>
          </div>

          {/* Auto-filled fields - show read-only summaries */}
          {(entityId || ssoUrl) && !showAdvanced && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Identity Provider</span>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Edit
                </button>
              </div>
              {entityId && (
                <p className="truncate text-sm">{entityId}</p>
              )}
              {ssoUrl && (
                <p className="truncate text-xs text-muted-foreground">{ssoUrl}</p>
              )}
              {sloUrl && (
                <p className="truncate text-xs text-muted-foreground">SLO: {sloUrl}</p>
              )}
              {(existingConfig?.certificate_preview || certificate) && (
                <p className="text-xs text-green-600">Certificate configured</p>
              )}
              {(existingConfig?.certificate_secondary_preview || certificateSecondary) && (
                <p className="text-xs text-green-600">Rollover certificate configured</p>
              )}
            </div>
          )}

          {/* Advanced / Manual configuration */}
          {(!entityId && !ssoUrl) || showAdvanced ? (
            <>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showAdvanced ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                {entityId ? "IdP Configuration" : "Manual Configuration"}
              </button>

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
                  className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
                {fieldErrors.entity_id && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.entity_id[0]}</p>
                )}
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
                  className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
                {fieldErrors.sso_url && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.sso_url[0]}</p>
                )}
              </div>

              {/* SLO URL */}
              <div>
                <label htmlFor="slo-url" className="mb-1.5 block text-sm font-medium">
                  SLO URL (Single Logout Endpoint)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                </label>
                <input
                  id="slo-url"
                  type="url"
                  value={sloUrl}
                  onChange={(e) => setSloUrl(e.target.value)}
                  placeholder="https://idp.example.com/saml/slo"
                  className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  If provided, users will be signed out of your IdP when they log out of OKrunit.
                </p>
              </div>

              {/* Primary Certificate */}
              <div>
                <label htmlFor="certificate" className="mb-1.5 block text-sm font-medium">
                  X.509 Certificate (PEM)
                </label>
                <textarea
                  id="certificate"
                  value={certificate}
                  onChange={(e) => setCertificate(e.target.value)}
                  placeholder={"-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----"}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  required={!existingConfig}
                />
                {fieldErrors.certificate && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.certificate[0]}</p>
                )}
                {existingConfig && !certificate && (
                  <p className="mt-1 text-xs text-amber-600">
                    Certificate on file. Paste a new one to replace, or leave blank to keep it.
                  </p>
                )}
              </div>

              {/* Secondary Certificate (rotation) */}
              <div>
                <label htmlFor="certificate-secondary" className="mb-1.5 block text-sm font-medium">
                  <KeyRound className="mr-1.5 inline size-3.5" />
                  Rollover Certificate
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
                </label>
                <textarea
                  id="certificate-secondary"
                  value={certificateSecondary}
                  onChange={(e) => setCertificateSecondary(e.target.value)}
                  placeholder={"Paste your IdP's new certificate here during a cert rotation"}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {fieldErrors.certificate_secondary && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.certificate_secondary[0]}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  During IdP certificate rotation, add the new certificate here. Both certificates will be accepted
                  until you remove the old one.
                </p>
                {existingConfig?.certificate_secondary_preview && !certificateSecondary && (
                  <p className="mt-1 text-xs text-amber-600">
                    Rollover certificate on file. Paste a new one to replace, or leave blank to keep it.
                  </p>
                )}
              </div>

              {/* Attribute mapping */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Attribute Mapping</h4>
                <p className="mb-3 text-xs text-muted-foreground">
                  Map SAML attributes from your IdP to OKrunit fields. Defaults work for most providers.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="attr-email" className="mb-1 block text-xs font-medium text-muted-foreground">
                      Email
                    </label>
                    <input
                      id="attr-email"
                      type="text"
                      value={attrEmail}
                      onChange={(e) => setAttrEmail(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="attr-first" className="mb-1 block text-xs font-medium text-muted-foreground">
                      First Name
                    </label>
                    <input
                      id="attr-first"
                      type="text"
                      value={attrFirstName}
                      onChange={(e) => setAttrFirstName(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="attr-last" className="mb-1 block text-xs font-medium text-muted-foreground">
                      Last Name
                    </label>
                    <input
                      id="attr-last"
                      type="text"
                      value={attrLastName}
                      onChange={(e) => setAttrLastName(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* Enable SSO toggle */}
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

          {/* Enforce SSO toggle - only show when SSO is active */}
          {isActive && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <button
                type="button"
                role="switch"
                aria-checked={enforceSso}
                onClick={() => setEnforceSso(!enforceSso)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                  enforceSso ? "bg-amber-500" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                    enforceSso ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="size-3.5" />
                  Require SSO
                </p>
                <p className="text-xs text-muted-foreground">
                  When enabled, users with @{ssoDomain || "company.com"} emails <strong>must</strong> use SSO to sign in.
                  Password and social login will be blocked for this domain.
                </p>
              </div>
            </div>
          )}
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
    </div>
  );
}
