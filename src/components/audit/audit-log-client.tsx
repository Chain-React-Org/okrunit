"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuditLogTable } from "@/components/audit/audit-log-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLogEntry } from "@/lib/types/database";

const PAGE_SIZE = 50;

interface AuditLogClientProps {
  orgId: string;
}

export function AuditLogClient({ orgId }: AuditLogClientProps) {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [connectionNames, setConnectionNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const auditEntries = (data as AuditLogEntry[]) ?? [];
      setEntries(auditEntries);

      // Resolve user names
      const userIds = [...new Set(auditEntries.map((e) => e.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) {
          map[p.id] = p.full_name || p.email;
        }
        setUserNames(map);
      }

      // Resolve connection names
      const connIds = [...new Set(auditEntries.map((e) => e.connection_id).filter(Boolean))] as string[];
      if (connIds.length > 0) {
        const { data: connections } = await supabase
          .from("connections")
          .select("id, name")
          .in("id", connIds);
        const map: Record<string, string> = {};
        for (const c of connections ?? []) {
          map[c.id] = c.name;
        }
        setConnectionNames(map);
      }
    };
    load();
  }, [orgId]);

  if (entries === null) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[200px]" />
        </div>
        <div className="rounded-xl border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-5 w-[70px] rounded-full" />
              <Skeleton className="h-4 w-[90px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[130px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <AuditLogTable initialEntries={entries} orgId={orgId} pageSize={PAGE_SIZE} userNames={userNames} connectionNames={connectionNames} />;
}
