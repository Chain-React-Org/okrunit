"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface OrgNameContextValue {
  /** Get the display name for an org (override or fallback to original). */
  getOrgName: (orgId: string, fallback: string) => string;
  /** Optimistically set a new name for an org. */
  setOrgName: (orgId: string, name: string) => void;
  /** Check if an org has been optimistically deleted. */
  isOrgDeleted: (orgId: string) => boolean;
  /** Mark an org as optimistically deleted. */
  deleteOrg: (orgId: string) => void;
}

const OrgNameContext = createContext<OrgNameContextValue | null>(null);

export function OrgNameProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const getOrgName = useCallback(
    (orgId: string, fallback: string) => overrides[orgId] ?? fallback,
    [overrides],
  );

  const setOrgName = useCallback((orgId: string, name: string) => {
    setOverrides((prev) => ({ ...prev, [orgId]: name }));
  }, []);

  const isOrgDeleted = useCallback(
    (orgId: string) => deletedIds.has(orgId),
    [deletedIds],
  );

  const deleteOrg = useCallback((orgId: string) => {
    setDeletedIds((prev) => new Set(prev).add(orgId));
  }, []);

  return (
    <OrgNameContext.Provider value={{ getOrgName, setOrgName, isOrgDeleted, deleteOrg }}>
      {children}
    </OrgNameContext.Provider>
  );
}

export function useOrgName() {
  const ctx = useContext(OrgNameContext);
  if (!ctx) throw new Error("useOrgName must be used within OrgNameProvider");
  return ctx;
}
