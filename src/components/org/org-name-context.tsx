"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface OrgNameContextValue {
  /** Get the display name for an org (override or fallback to original). */
  getOrgName: (orgId: string, fallback: string) => string;
  /** Optimistically set a new name for an org. */
  setOrgName: (orgId: string, name: string) => void;
}

const OrgNameContext = createContext<OrgNameContextValue | null>(null);

export function OrgNameProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const getOrgName = useCallback(
    (orgId: string, fallback: string) => overrides[orgId] ?? fallback,
    [overrides],
  );

  const setOrgName = useCallback((orgId: string, name: string) => {
    setOverrides((prev) => ({ ...prev, [orgId]: name }));
  }, []);

  return (
    <OrgNameContext.Provider value={{ getOrgName, setOrgName }}>
      {children}
    </OrgNameContext.Provider>
  );
}

export function useOrgName() {
  const ctx = useContext(OrgNameContext);
  if (!ctx) throw new Error("useOrgName must be used within OrgNameProvider");
  return ctx;
}
