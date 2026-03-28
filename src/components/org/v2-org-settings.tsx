"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Globe,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  Timer,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  ApprovalPriority,
  FourEyesConfig,
  GeoRestrictions,
  Organization,
  SlaConfig,
  UserRole,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roleConfig = {
  owner: { icon: Crown, label: "Owner", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-200" },
  admin: { icon: Shield, label: "Admin", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200" },
  member: { icon: User, label: "Member", color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
} as const;

type RejectionPolicy = "optional" | "required" | "required_high_critical";

const rejectionPolicyLabels: Record<RejectionPolicy, string> = {
  optional: "Optional",
  required: "Always required",
  required_high_critical: "Required for high & critical",
};

const priorityLabels: Record<ApprovalPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border/50 bg-[var(--card)] divide-y divide-border/40">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="sm:w-[280px] shrink-0 flex justify-end">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Response time dropdown with custom option
// ---------------------------------------------------------------------------

const responseTimePresets = [
  { value: "none", label: "No limit" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
  { value: "custom", label: "Custom..." },
] as const;

function ResponseTimeRow({
  priority,
  value,
  onChange,
  disabled,
}: {
  priority: ApprovalPriority;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
}) {
  const isPreset = value === null || responseTimePresets.some(
    (p) => p.value !== "none" && p.value !== "custom" && parseInt(p.value, 10) === value,
  );
  const [showCustom, setShowCustom] = useState(!isPreset && value !== null);

  const selectValue = value === null
    ? "none"
    : showCustom
      ? "custom"
      : String(value);

  return (
    <SettingsRow
      label={`${priorityLabels[priority]} priority`}
      description={`Target response time for ${priority} priority requests.`}
    >
      <div className="flex items-center gap-2">
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === "none") {
              setShowCustom(false);
              onChange(null);
            } else if (v === "custom") {
              setShowCustom(true);
            } else {
              setShowCustom(false);
              onChange(parseInt(v, 10));
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {responseTimePresets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value} className="text-xs">
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showCustom && (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
              placeholder="Minutes"
              disabled={disabled}
              className="h-9 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground shrink-0">min</span>
          </div>
        )}
      </div>
    </SettingsRow>
  );
}

// ---------------------------------------------------------------------------
// Session timeout dropdown with custom option
// ---------------------------------------------------------------------------

const sessionTimeoutPresets = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "7 days" },
  { value: "43200", label: "30 days" },
  { value: "custom", label: "Custom..." },
] as const;

function SessionTimeoutSelect({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const isPreset = sessionTimeoutPresets.some(
    (p) => p.value !== "custom" && parseInt(p.value, 10) === value,
  );
  const [showCustom, setShowCustom] = useState(!isPreset);

  const selectValue = showCustom ? "custom" : String(value);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "custom") {
            setShowCustom(true);
          } else {
            setShowCustom(false);
            onChange(parseInt(v, 10));
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sessionTimeoutPresets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value} className="text-xs">
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={5}
            max={43200}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 5)}
            disabled={disabled}
            className="h-9 w-20 text-xs"
          />
          <span className="text-xs text-muted-foreground shrink-0">min</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Country multi-select
// ---------------------------------------------------------------------------

import { ALL_COUNTRIES, COUNTRY_BY_CODE } from "@/lib/countries";

function CountryMultiSelect({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (countries: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return ALL_COUNTRIES;
    const q = search.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [search]);

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  return (
    <div className="w-full space-y-2" ref={containerRef}>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => !disabled && toggle(code)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
            >
              {COUNTRY_BY_CODE.get(code) ?? code}
              <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-white px-3 text-xs text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selected.length === 0 ? "Select countries..." : `${selected.length} selected`}
          <svg className="size-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
            <div className="border-b border-border p-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500">No countries found</p>
              )}
              {filtered.map((country) => {
                const isSelected = selected.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggle(country.code)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-900 hover:bg-slate-50"
                  >
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                      {isSelected && (
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 text-left">{country.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{country.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface V2OrgSettingsProps {
  org: Organization;
  role: UserRole;
}

export function V2OrgSettings({ org, role }: V2OrgSettingsProps) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "admin";
  const rc = roleConfig[role];
  const RoleIcon = rc.icon;

  const [saving, setSaving] = useState(false);

  // ---- Local state ----
  const [rejectionPolicy, setRejectionPolicy] = useState<RejectionPolicy>(
    org.rejection_reason_policy as RejectionPolicy,
  );
  const [requireReauth, setRequireReauth] = useState(org.require_reauth_for_critical);
  const [fourEyes, setFourEyes] = useState<FourEyesConfig>(org.four_eyes_config);
  const [sla, setSla] = useState<SlaConfig>(org.sla_config);
  const [sessionTimeout, setSessionTimeout] = useState(org.session_timeout_minutes);
  const [ipAllowlist, setIpAllowlist] = useState(org.ip_allowlist.join("\n"));
  const [geoRestrictions, setGeoRestrictions] = useState<GeoRestrictions>(org.geo_restrictions);
  const [geoCountriesInput, setGeoCountriesInput] = useState(
    org.geo_restrictions.allowed_countries.join(", "),
  );

  // ---- Dirty check ----
  const parsedIps = useMemo(
    () => ipAllowlist.split("\n").map((s) => s.trim()).filter(Boolean),
    [ipAllowlist],
  );
  const parsedCountries = useMemo(
    () => geoCountriesInput.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2),
    [geoCountriesInput],
  );

  const hasChanges = useMemo(() => {
    if (rejectionPolicy !== org.rejection_reason_policy) return true;
    if (requireReauth !== org.require_reauth_for_critical) return true;
    if (fourEyes.enabled !== org.four_eyes_config.enabled) return true;
    if ((fourEyes.min_priority ?? null) !== (org.four_eyes_config.min_priority ?? null)) return true;
    if (sla.low !== org.sla_config.low) return true;
    if (sla.medium !== org.sla_config.medium) return true;
    if (sla.high !== org.sla_config.high) return true;
    if (sla.critical !== org.sla_config.critical) return true;
    if (sessionTimeout !== org.session_timeout_minutes) return true;
    if (parsedIps.join("\n") !== org.ip_allowlist.join("\n")) return true;
    if (geoRestrictions.enabled !== org.geo_restrictions.enabled) return true;
    if (parsedCountries.join(",") !== org.geo_restrictions.allowed_countries.join(",")) return true;
    return false;
  }, [
    rejectionPolicy, requireReauth, fourEyes, sla, sessionTimeout,
    parsedIps, geoRestrictions.enabled, parsedCountries, org,
  ]);

  // ---- Save all changes ----
  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};

      if (rejectionPolicy !== org.rejection_reason_policy) {
        payload.rejection_reason_policy = rejectionPolicy;
      }
      if (requireReauth !== org.require_reauth_for_critical) {
        payload.require_reauth_for_critical = requireReauth;
      }
      if (
        fourEyes.enabled !== org.four_eyes_config.enabled ||
        (fourEyes.min_priority ?? null) !== (org.four_eyes_config.min_priority ?? null)
      ) {
        payload.four_eyes_config = fourEyes;
      }
      if (
        sla.low !== org.sla_config.low ||
        sla.medium !== org.sla_config.medium ||
        sla.high !== org.sla_config.high ||
        sla.critical !== org.sla_config.critical
      ) {
        payload.sla_config = sla;
      }
      if (sessionTimeout !== org.session_timeout_minutes) {
        payload.session_timeout_minutes = sessionTimeout;
      }
      if (parsedIps.join("\n") !== org.ip_allowlist.join("\n")) {
        payload.ip_allowlist = parsedIps;
      }
      if (
        geoRestrictions.enabled !== org.geo_restrictions.enabled ||
        parsedCountries.join(",") !== org.geo_restrictions.allowed_countries.join(",")
      ) {
        payload.geo_restrictions = {
          enabled: geoRestrictions.enabled,
          allowed_countries: parsedCountries,
        };
      }

      if (Object.keys(payload).length === 0) return;

      const res = await fetch("/api/v1/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update");
      }

      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setRejectionPolicy(org.rejection_reason_policy as RejectionPolicy);
    setRequireReauth(org.require_reauth_for_critical);
    setFourEyes(org.four_eyes_config);
    setSla(org.sla_config);
    setSessionTimeout(org.session_timeout_minutes);
    setIpAllowlist(org.ip_allowlist.join("\n"));
    setGeoRestrictions(org.geo_restrictions);
    setGeoCountriesInput(org.geo_restrictions.allowed_countries.join(", "));
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Your Role */}
      <SettingsSection
        title="Your Role"
        description="Your permission level within this organization."
        icon={User}
      >
        <SettingsRow label="Current role">
          <span className={`inline-flex items-center gap-1.5 rounded-lg border ${rc.border} ${rc.bg} px-3 py-1.5 text-sm font-medium ${rc.color}`}>
            <RoleIcon className="size-3.5" />
            {rc.label}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Approval Policies */}
      <SettingsSection
        title="Approval Policies"
        description="Control how approvals are handled across your organization."
        icon={ShieldCheck}
      >
        <SettingsRow
          label="Rejection reason policy"
          description="When reviewers must provide a reason for rejecting a request."
        >
          <Select
            value={rejectionPolicy}
            onValueChange={(v) => setRejectionPolicy(v as RejectionPolicy)}
            disabled={!canEdit}
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(rejectionPolicyLabels).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Re-authentication for critical"
          description="Require users to re-authenticate before approving critical requests."
        >
          <Switch
            checked={requireReauth}
            onCheckedChange={setRequireReauth}
            disabled={!canEdit}
          />
        </SettingsRow>

        <SettingsRow
          label="Four-eyes principle"
          description="Require a different person to approve than the one who created the request."
        >
          <Switch
            checked={fourEyes.enabled}
            onCheckedChange={(checked) => setFourEyes((prev) => ({ ...prev, enabled: checked }))}
            disabled={!canEdit}
          />
        </SettingsRow>

        {fourEyes.enabled && (
          <SettingsRow
            label="Four-eyes minimum priority"
            description="Only enforce four-eyes for requests at or above this priority."
          >
            <Select
              value={fourEyes.min_priority ?? "all"}
              onValueChange={(v) =>
                setFourEyes((prev) => ({
                  ...prev,
                  min_priority: v === "all" ? null : (v as ApprovalPriority),
                }))
              }
              disabled={!canEdit}
            >
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All priorities</SelectItem>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label} and above
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Response Time Targets */}
      <SettingsSection
        title="Response Time Targets"
        description="How quickly your team should respond to requests at each priority level."
        icon={Timer}
      >
        {(["low", "medium", "high", "critical"] as const).map((priority) => (
          <ResponseTimeRow
            key={priority}
            priority={priority}
            value={sla[priority]}
            onChange={(v) => setSla((prev) => ({ ...prev, [priority]: v }))}
            disabled={!canEdit}
          />
        ))}
      </SettingsSection>

      {/* Security */}
      <SettingsSection
        title="Security"
        description="Control access and session behavior for your organization."
        icon={Lock}
      >
        <SettingsRow
          label="Session timeout"
          description="Automatically sign out inactive users after this duration."
        >
          <SessionTimeoutSelect
            value={sessionTimeout}
            onChange={setSessionTimeout}
            disabled={!canEdit}
          />
        </SettingsRow>

        <SettingsRow
          label="IP allowlist"
          description="Restrict dashboard access to specific IP addresses. One per line. Leave empty to allow all."
        >
          <textarea
            value={ipAllowlist}
            onChange={(e) => setIpAllowlist(e.target.value)}
            placeholder={"192.168.1.0/24\n10.0.0.1"}
            disabled={!canEdit}
            rows={3}
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-[280px]"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Geo Restrictions */}
      <SettingsSection
        title="Geo Restrictions"
        description="Restrict access to specific countries using ISO 3166-1 alpha-2 codes."
        icon={Globe}
      >
        <SettingsRow
          label="Enable geo restrictions"
          description="Only allow access from specified countries."
        >
          <Switch
            checked={geoRestrictions.enabled}
            onCheckedChange={(checked) => setGeoRestrictions((prev) => ({ ...prev, enabled: checked }))}
            disabled={!canEdit}
          />
        </SettingsRow>

        {geoRestrictions.enabled && (
          <SettingsRow
            label="Allowed countries"
            description="Select which countries can access your organization."
          >
            <CountryMultiSelect
              selected={parsedCountries}
              onChange={(countries) => {
                setGeoCountriesInput(countries.join(", "));
                setGeoRestrictions((prev) => ({ ...prev, allowed_countries: countries }));
              }}
              disabled={!canEdit}
            />
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Sticky save bar */}
      {canEdit && hasChanges && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
