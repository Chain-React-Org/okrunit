"use client";

import { useEffect } from "react";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Detect source/medium from referrer URL when no UTM params are present */
function detectSource(referrer: string): { source: string; medium: string } {
  if (!referrer) return { source: "direct", medium: "none" };

  try {
    const host = new URL(referrer).hostname.replace("www.", "");

    // Search engines
    if (host.includes("google")) return { source: "google", medium: "organic" };
    if (host.includes("bing")) return { source: "bing", medium: "organic" };
    if (host.includes("duckduckgo")) return { source: "duckduckgo", medium: "organic" };
    if (host.includes("yahoo")) return { source: "yahoo", medium: "organic" };
    if (host.includes("baidu")) return { source: "baidu", medium: "organic" };

    // Social
    if (host.includes("facebook") || host.includes("fb.com")) return { source: "facebook", medium: "social" };
    if (host.includes("twitter") || host.includes("t.co") || host.includes("x.com")) return { source: "twitter", medium: "social" };
    if (host.includes("linkedin")) return { source: "linkedin", medium: "social" };
    if (host.includes("reddit")) return { source: "reddit", medium: "social" };
    if (host.includes("youtube")) return { source: "youtube", medium: "social" };
    if (host.includes("instagram")) return { source: "instagram", medium: "social" };
    if (host.includes("tiktok")) return { source: "tiktok", medium: "social" };

    // Platforms
    if (host.includes("github")) return { source: "github", medium: "referral" };
    if (host.includes("producthunt")) return { source: "producthunt", medium: "referral" };
    if (host.includes("hackernews") || host.includes("ycombinator")) return { source: "hackernews", medium: "referral" };

    // Generic referral
    return { source: host, medium: "referral" };
  } catch {
    return { source: "unknown", medium: "referral" };
  }
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Other";
}

export function UTMTracker() {
  useEffect(() => {
    // Skip if already tracked this visit
    if (getCookie("__okr_utm_sent")) return;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    const utmMedium = params.get("utm_medium");
    const utmCampaign = params.get("utm_campaign");

    // Auto-detect source from referrer if no UTM params
    let source = utmSource;
    let medium = utmMedium;
    if (!utmSource) {
      const detected = detectSource(document.referrer);
      source = detected.source;
      medium = detected.medium;
    }

    // Get or create visitor ID
    let visitorId = getCookie("__okr_vid");
    if (!visitorId) {
      visitorId = generateId();
      setCookie("__okr_vid", visitorId, 30);
    }

    const startTime = Date.now();

    // Record the visit
    fetch("/api/tracking/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        utmSource: source || undefined,
        utmMedium: medium || undefined,
        utmCampaign: utmCampaign || undefined,
        referrer: document.referrer || undefined,
        landingPage: window.location.pathname,
        deviceType: getDeviceType(),
        browser: getBrowser(),
      }),
    }).catch(() => {});

    // Mark as sent (30-day cookie)
    setCookie("__okr_utm_sent", "1", 30);

    // Send duration on page unload
    const sendDuration = () => {
      const seconds = Math.round((Date.now() - startTime) / 1000);
      if (seconds < 1) return;
      navigator.sendBeacon(
        "/api/tracking/visit",
        new Blob(
          [JSON.stringify({ visitorId, duration: seconds })],
          { type: "application/json" },
        ),
      );
    };

    // visibilitychange is more reliable than beforeunload on mobile
    const handleVisChange = () => {
      if (document.visibilityState === "hidden") sendDuration();
    };
    document.addEventListener("visibilitychange", handleVisChange);
    window.addEventListener("beforeunload", sendDuration);

    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
      window.removeEventListener("beforeunload", sendDuration);
    };
  }, []);

  return null;
}
