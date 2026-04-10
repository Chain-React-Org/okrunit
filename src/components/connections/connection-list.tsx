"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConnectionCard } from "@/components/connections/connection-card";
import { ConnectionForm } from "@/components/connections/connection-form";
import { EmptyState } from "@/components/ui/empty-state";
import type { Connection } from "@/lib/types/database";

// ---- Component --------------------------------------------------------------

interface ConnectionListProps {
  initialConnections: Connection[];
}

export function ConnectionList({ initialConnections }: ConnectionListProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [connections, setConnections] = useState(initialConnections);

  // Keep in sync if server data changes (e.g. after create)
  useEffect(() => { setConnections(initialConnections); }, [initialConnections]);

  // ---- Handlers -----------------------------------------------------------

  async function handleDeactivate(id: string) {
    // Optimistic update
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
    try {
      const res = await fetch(`/api/v1/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to deactivate connection");
      }

      toast.success("Connection deactivated");
    } catch (err) {
      // Revert on failure
      setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: true } : c));
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate connection",
      );
    }
  }

  async function handleActivate(id: string) {
    // Optimistic update
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: true } : c));
    try {
      const res = await fetch(`/api/v1/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to activate connection");
      }

      toast.success("Connection activated");
    } catch (err) {
      // Revert on failure
      setConnections((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
      toast.error(
        err instanceof Error ? err.message : "Failed to activate connection",
      );
    }
  }

  async function handleDelete(id: string) {
    // Optimistic removal
    const removed = connections.find((c) => c.id === id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/v1/connections/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to delete connection");
      }

      toast.success("Connection deleted");
    } catch (err) {
      // Revert on failure
      if (removed) setConnections((prev) => [...prev, removed]);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete connection",
      );
    }
  }

  // ---- Render -------------------------------------------------------------

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button data-tour="create-connection-btn" variant="outline" className="bg-[var(--card)]" onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Connection
        </Button>
      </div>

      {/* Connection cards or empty state */}
      {connections.length === 0 ? (
        <EmptyState
          icon={Unplug}
          title="No API key connections"
          description="Most integrations connect automatically through their own app (e.g. Zapier). Create a manual API key connection only if you need direct API access for custom scripts or agents."
          action={{
            label: "Create Manual Connection",
            onClick: () => setCreateOpen(true),
            variant: "outline",
          }}
        />
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onDeactivate={handleDeactivate}
              onActivate={handleActivate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <ConnectionForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          router.refresh(); // Fetch the new connection from server
        }}
      />
    </>
  );
}
