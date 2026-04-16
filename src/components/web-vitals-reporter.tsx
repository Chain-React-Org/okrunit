"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB) to the monitoring API.
 * Uses the web-vitals library via dynamic import to avoid bundling it for
 * users who don't need it. Mount once in the root layout.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();

  useEffect(() => {
    // Only report in production to avoid noise during development
    if (process.env.NODE_ENV !== "production") return;

    const connection = (navigator as unknown as Record<string, unknown>).connection as
      | { effectiveType?: string }
      | undefined;
    const connectionType = connection?.effectiveType ?? undefined;

    function reportVital(metric: { name: string; value: number; rating: string }) {
      // Use sendBeacon for reliability on page unload, fall back to fetch
      const body = JSON.stringify({
        metric: metric.name,
        value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        rating: metric.rating,
        pathname,
        connectionType,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/v1/admin/perf", body);
      } else {
        fetch("/api/v1/admin/perf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    }

    // Dynamic import so web-vitals doesn't add to initial bundle
    import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
      onLCP(reportVital);
      onCLS(reportVital);
      onINP(reportVital);
      onFCP(reportVital);
      onTTFB(reportVital);
    }).catch(() => {
      // web-vitals not available, skip silently
    });
  }, [pathname]);

  return null;
}
