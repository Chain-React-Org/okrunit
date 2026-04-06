"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Connection } from "@/lib/types/database";

// ---- Types ----------------------------------------------------------------

interface ScopingFormProps {
  connection: Connection;
  onSave: () => void;
}

// ---- Priority options -----------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: "none", label: "No limit" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

// ---- Common action types for the dropdown --------------------------------

const COMMON_ACTION_TYPES = [
  "deploy",
  "database_migration",
  "infrastructure_change",
  "release",
  "access_request",
  "config_change",
  "delete",
  "billing_change",
  "user_management",
] as const;

// ---- Helpers --------------------------------------------------------------

function parseIpAllowlist(connection: Connection): string[] {
  if (
    connection.scoping_rules &&
    typeof connection.scoping_rules === "object"
  ) {
    const rules = connection.scoping_rules as Record<string, unknown>;
    if (Array.isArray(rules.ip_allowlist)) {
      return rules.ip_allowlist.filter(
        (ip): ip is string => typeof ip === "string",
      );
    }
  }
  return [];
}

// ---- Component ------------------------------------------------------------

export function ScopingForm({ connection, onSave }: ScopingFormProps) {
  // -- State: Allowed action types -------------------------------------------
  const [actionTypes, setActionTypes] = useState<string[]>(
    connection.allowed_action_types ?? [],
  );
  const [actionTypeInput, setActionTypeInput] = useState("");

  // -- State: Maximum priority -----------------------------------------------
  const [maxPriority, setMaxPriority] = useState<string>(
    connection.max_priority ?? "none",
  );

  // -- State: IP allowlist ---------------------------------------------------
  const [ipList, setIpList] = useState<string[]>(
    parseIpAllowlist(connection),
  );
  const [ipInput, setIpInput] = useState("");

  // -- State: Loading --------------------------------------------------------
  const [saving, setSaving] = useState(false);

  // -- Action type dropdown management ---------------------------------------

  const addActionType = useCallback((value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (actionTypes.includes(trimmed)) {
      toast.error(`"${trimmed}" is already in the list`);
      return;
    }
    setActionTypes((prev) => [...prev, trimmed]);
    setActionTypeInput("");
  }, [actionTypes]);

  const removeActionType = useCallback((type: string) => {
    setActionTypes((prev) => prev.filter((t) => t !== type));
  }, []);

  const handleActionTypeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addActionType(actionTypeInput);
      }
    },
    [addActionType, actionTypeInput],
  );

  // -- IP allowlist management -----------------------------------------------

  const addIps = useCallback(() => {
    const newIps = ipInput
      .split(/[,\n]/)
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (newIps.length === 0) return;

    const dupes: string[] = [];
    const toAdd: string[] = [];
    for (const ip of newIps) {
      if (ipList.includes(ip)) {
        dupes.push(ip);
      } else {
        toAdd.push(ip);
      }
    }
    if (dupes.length > 0) {
      toast.error(`Already in the list: ${dupes.join(", ")}`);
    }
    if (toAdd.length > 0) {
      setIpList((prev) => [...prev, ...toAdd]);
    }
    setIpInput("");
  }, [ipInput, ipList]);

  const removeIp = useCallback((ip: string) => {
    setIpList((prev) => prev.filter((i) => i !== ip));
  }, []);

  const handleIpKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addIps();
      }
    },
    [addIps],
  );

  // -- Save handler ----------------------------------------------------------

  async function handleSave() {
    setSaving(true);

    // Build the scoping_rules object from the IP pill list.
    const scopingRules =
      ipList.length > 0 ? { ip_allowlist: ipList } : null;

    const body: Record<string, unknown> = {
      allowed_action_types: actionTypes.length > 0 ? actionTypes : null,
      max_priority: maxPriority === "none" ? null : maxPriority,
      scoping_rules: scopingRules,
    };

    try {
      const res = await fetch(`/api/v1/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save scoping rules");
      }

      toast.success("Connection scoping rules updated");
      onSave();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSaving(false);
    }
  }

  // -- Render ----------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Scoping</CardTitle>
        <CardDescription>
          Restrict what this connection is allowed to submit. Leave fields empty
          for no restrictions.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ---- Allowed Action Types ---------------------------------------- */}
        <div className="space-y-2">
          <Label>Allowed Action Types</Label>
          <p className="text-muted-foreground text-sm">
            Only these action types will be accepted. Leave empty to allow all.
          </p>

          {/* Dropdown for common action types */}
          <Select
            value=""
            onValueChange={(value) => {
              if (value === "__custom__") return;
              addActionType(value);
            }}
            disabled={saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an action type to add..." />
            </SelectTrigger>
            <SelectContent>
              {COMMON_ACTION_TYPES.filter(
                (type) => !actionTypes.includes(type),
              ).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
              {COMMON_ACTION_TYPES.filter((t) => !actionTypes.includes(t))
                .length > 0 &&
                COMMON_ACTION_TYPES.filter((t) => !actionTypes.includes(t))
                  .length < COMMON_ACTION_TYPES.length && (
                  <div className="border-t my-1" />
                )}
              <SelectItem value="__custom__" disabled>
                <span className="text-muted-foreground">
                  Or type a custom value below
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Custom action type input */}
          <div className="flex gap-2">
            <Input
              placeholder="Custom action type..."
              value={actionTypeInput}
              onChange={(e) => setActionTypeInput(e.target.value)}
              onKeyDown={handleActionTypeKeyDown}
              disabled={saving}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addActionType(actionTypeInput)}
              disabled={saving || !actionTypeInput.trim()}
            >
              Add
            </Button>
          </div>

          {/* Selected action types as removable pills */}
          {actionTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {actionTypes.map((type) => (
                <Badge key={type} variant="secondary" className="gap-1 pr-1">
                  {type}
                  <button
                    type="button"
                    onClick={() => removeActionType(type)}
                    className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                    aria-label={`Remove ${type}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ---- Maximum Priority -------------------------------------------- */}
        <div className="space-y-2">
          <Label>Maximum Priority</Label>
          <p className="text-muted-foreground text-sm">
            Requests with a priority higher than this will be rejected.
          </p>
          <Select value={maxPriority} onValueChange={setMaxPriority}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select maximum priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ---- IP Allowlist ------------------------------------------------ */}
        <div className="space-y-2">
          <Label>IP Allowlist</Label>
          <p className="text-muted-foreground text-sm">
            Only requests from these IP addresses will be accepted. Leave empty
            to allow all.
          </p>

          {/* Input + Add button */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. 192.168.1.1 or comma-separated list"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyDown={handleIpKeyDown}
              disabled={saving}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addIps}
              disabled={saving || !ipInput.trim()}
            >
              <Plus className="size-4 mr-1" />
              Add
            </Button>
          </div>

          {/* IP pill list */}
          {ipList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
              {ipList.map((ip) => (
                <Badge
                  key={ip}
                  variant="secondary"
                  className="gap-1 pr-1 font-mono text-xs"
                >
                  {ip}
                  <button
                    type="button"
                    onClick={() => removeIp(ip)}
                    className="hover:bg-destructive/20 ml-0.5 rounded-full p-0.5"
                    aria-label={`Remove ${ip}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
          {saving ? "Saving..." : "Save Scoping Rules"}
        </Button>
      </CardFooter>
    </Card>
  );
}
