"use client";

import { useState, useEffect } from "react";
import { XCircle, Loader2, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HealthStatus {
  status: "healthy" | "unhealthy";
  database: string;
  duration_ms: number;
  timestamp: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === "healthy";

  return (
    <div>
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          System Status
        </h1>
        <p className="mt-2 text-lg text-zinc-600">
          Real-time health checks for OKrunit services.
        </p>
      </div>

        {/* Main status */}
        <div className="rounded-2xl border border-zinc-200 p-8 text-center">
          {loading && !health ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-10 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Checking system status...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="size-10 text-red-500" />
              <h2 className="text-xl font-semibold text-red-600">Unable to reach service</h2>
              <p className="text-sm text-zinc-500">
                We&apos;re having trouble connecting. Please try again in a few minutes.
              </p>
            </div>
          ) : isHealthy ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="size-10 text-emerald-500" />
              <h2 className="text-xl font-semibold text-emerald-600">All Systems Operational</h2>
              <p className="text-sm text-zinc-500">
                Response time: {health?.duration_ms}ms
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="size-10 text-amber-500" />
              <h2 className="text-xl font-semibold text-amber-600">Degraded Performance</h2>
              <p className="text-sm text-zinc-500">
                Database: {health?.database}
              </p>
            </div>
          )}

          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={checkHealth}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Service components */}
        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">Components</h3>
          {[
            { name: "Web Application", status: isHealthy },
            { name: "Database (PostgreSQL)", status: health?.database === "connected" },
            { name: "API", status: isHealthy },
            { name: "Webhooks", status: isHealthy },
          ].map((component) => (
            <div
              key={component.name}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
            >
              <span className="text-sm text-zinc-700">{component.name}</span>
              <span className="flex items-center gap-1.5 text-xs">
                {loading && !health ? (
                  <Loader2 className="size-3 animate-spin text-zinc-400" />
                ) : component.status ? (
                  <>
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-600">Operational</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 rounded-full bg-red-500" />
                    <span className="text-red-600">Issue</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>

        {health?.timestamp && (
          <p className="mt-6 text-center text-xs text-zinc-400">
            Last checked: {new Date(health.timestamp).toLocaleString()}
          </p>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500">
            For incident reports, contact{" "}
            <a href="mailto:support@okrunit.com" className="text-primary hover:underline">
              support@okrunit.com
            </a>
          </p>
        </div>
    </div>
  );
}
