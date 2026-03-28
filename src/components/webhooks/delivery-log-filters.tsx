"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Webhook Delivery Log Filters (Client Component)
// Filter controls for narrowing down delivery log entries by status,
// connection, and date range.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Connection } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_VALUE = "__all__";
const CUSTOM_VALUE = "__custom__";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryLogFilters {
  status: "all" | "success" | "failure";
  connectionId: string | null;
  dateRange: string;
  customFrom: string | null;
  customTo: string | null;
}

interface DeliveryLogFiltersProps {
  connections: Connection[];
  onFilterChange: (filters: DeliveryLogFilters) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeliveryLogFilters({
  connections,
  onFilterChange,
}: DeliveryLogFiltersProps) {
  const [status, setStatus] = useState<string>(ALL_VALUE);
  const [connectionId, setConnectionId] = useState<string>(ALL_VALUE);
  const [dateRange, setDateRange] = useState<string>(ALL_VALUE);
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const emitChange = useCallback(
    (
      nextStatus: string,
      nextConnectionId: string,
      nextDateRange: string,
      nextCustomFrom: string,
      nextCustomTo: string,
    ) => {
      onFilterChange({
        status:
          nextStatus === ALL_VALUE
            ? "all"
            : (nextStatus as "success" | "failure"),
        connectionId:
          nextConnectionId === ALL_VALUE ? null : nextConnectionId,
        dateRange: nextDateRange === ALL_VALUE ? "all" : nextDateRange === CUSTOM_VALUE ? "custom" : nextDateRange,
        customFrom: nextDateRange === CUSTOM_VALUE && nextCustomFrom ? nextCustomFrom : null,
        customTo: nextDateRange === CUSTOM_VALUE && nextCustomTo ? nextCustomTo : null,
      });
    },
    [onFilterChange]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(value);
      emitChange(value, connectionId, dateRange, customFrom, customTo);
    },
    [connectionId, dateRange, customFrom, customTo, emitChange]
  );

  const handleConnectionChange = useCallback(
    (value: string) => {
      setConnectionId(value);
      emitChange(status, value, dateRange, customFrom, customTo);
    },
    [status, dateRange, customFrom, customTo, emitChange]
  );

  const handleDateRangeChange = useCallback(
    (value: string) => {
      setDateRange(value);
      emitChange(status, connectionId, value, customFrom, customTo);
    },
    [status, connectionId, customFrom, customTo, emitChange]
  );

  const handleCustomFromChange = useCallback(
    (value: string) => {
      setCustomFrom(value);
      emitChange(status, connectionId, dateRange, value, customTo);
    },
    [status, connectionId, dateRange, customTo, emitChange]
  );

  const handleCustomToChange = useCallback(
    (value: string) => {
      setCustomTo(value);
      emitChange(status, connectionId, dateRange, customFrom, value);
    },
    [status, connectionId, dateRange, customFrom, emitChange]
  );

  const clearFilters = useCallback(() => {
    setStatus(ALL_VALUE);
    setConnectionId(ALL_VALUE);
    setDateRange(ALL_VALUE);
    setCustomFrom("");
    setCustomTo("");
    onFilterChange({ status: "all", connectionId: null, dateRange: "all", customFrom: null, customTo: null });
  }, [onFilterChange]);

  const hasActiveFilters =
    status !== ALL_VALUE || connectionId !== ALL_VALUE || dateRange !== ALL_VALUE;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      {/* Status filter */}
      <Select value={status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px] bg-white text-gray-900">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failure">Failed</SelectItem>
        </SelectContent>
      </Select>

      {/* Connection filter */}
      <Select value={connectionId} onValueChange={handleConnectionChange}>
        <SelectTrigger className="w-full sm:w-[220px] bg-white text-gray-900">
          <SelectValue placeholder="All connections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All connections</SelectItem>
          {connections.map((conn) => (
            <SelectItem key={conn.id} value={conn.id}>
              {conn.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range filter */}
      <Select value={dateRange} onValueChange={handleDateRangeChange}>
        <SelectTrigger className="w-full sm:w-[180px] bg-white text-gray-900">
          <SelectValue placeholder="All time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All time</SelectItem>
          <SelectItem value="1h">Last hour</SelectItem>
          <SelectItem value="24h">Last 24 hours</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
          <SelectItem value={CUSTOM_VALUE}>Custom range</SelectItem>
        </SelectContent>
      </Select>

      {/* Custom date inputs */}
      {dateRange === CUSTOM_VALUE && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => handleCustomFromChange(e.target.value)}
            className="h-9 w-[150px] bg-white text-gray-900"
            max={customTo || undefined}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => handleCustomToChange(e.target.value)}
            className="h-9 w-[150px] bg-white text-gray-900"
            min={customFrom || undefined}
          />
        </div>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
