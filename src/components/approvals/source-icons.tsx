"use client";

import { Bot, Globe, Link2, Cloud, Code2, GitBranch, Rocket, Server, Workflow, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalRequest } from "@/lib/types/database";

// ---- SVG platform logos (inline, small, mono-friendly) --------------------

function ZapierLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor">
      <path d="M63.207 26.418H44.432l13.193-13.193c-1.015-1.522-2.03-2.537-3.045-4.06a29.025 29.025 0 01-4.059-3.552L37.33 18.807V.54a17.252 17.252 0 00-5.074-.507A15.629 15.629 0 0027.18.54v18.775l-13.7-13.7A13.7 13.7 0 009.42 9.166c-1.015 1.522-2.537 2.537-3.552 4.06L19.06 26.418H.794l-.507 5.074a15.629 15.629 0 00.507 5.074H19.57l-13.7 13.7a27.198 27.198 0 007.611 7.611l13.193-13.193V63.46a17.252 17.252 0 005.074.507 15.629 15.629 0 005.074-.507V44.686L50.014 57.88a13.7 13.7 0 004.059-3.552 29.025 29.025 0 003.552-4.059L44.432 37.074h18.775A17.252 17.252 0 0063.715 32a19.028 19.028 0 00-.507-5.582zm-23.342 5.074a25.726 25.726 0 01-1.015 6.597 15.223 15.223 0 01-6.597 1.015 25.726 25.726 0 01-6.597-1.015 15.223 15.223 0 01-1.015-6.597 25.726 25.726 0 011.015-6.597 15.223 15.223 0 016.597-1.015 25.726 25.726 0 016.597 1.015 29.684 29.684 0 011.015 6.597z" />
    </svg>
  );
}

function MakeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" />
    </svg>
  );
}

function MondayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3.283 14.682a3.283 3.283 0 0 1-2.878-4.874l3.337-6.063a3.283 3.283 0 0 1 5.756 3.166L6.161 12.97a3.283 3.283 0 0 1-2.878 1.712zm8.249 0a3.283 3.283 0 0 1-2.878-4.874l3.337-6.063a3.283 3.283 0 0 1 5.756 3.166l-3.337 6.063a3.283 3.283 0 0 1-2.878 1.708zm8.25-3.282a3.283 3.283 0 1 1 0-6.565 3.283 3.283 0 0 1 0 6.565z" />
    </svg>
  );
}

function N8nLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      {/* Three connected workflow nodes - n8n brand style */}
      <circle cx="7" cy="15.5" r="3" />
      <circle cx="17" cy="15.5" r="3" />
      <circle cx="17" cy="7.5" r="3" />
      <rect x="10" y="14.5" width="4" height="2" rx="1" />
      <rect x="16" y="10.5" width="2" height="2" rx="1" />
    </svg>
  );
}

// ---- Source configuration -------------------------------------------------

export interface SourceDisplayConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // Tailwind text color for the icon
  bgColor: string; // Tailwind bg color for the badge/avatar
}

/** Sources that are actually available as integrations (excludes "coming soon"). */
export const AVAILABLE_SOURCES = new Set([
  "zapier", "make", "n8n", "monday", "github-actions",
  "temporal", "prefect", "dagster", "windmill", "pipedream", "api",
]);

export const SOURCE_CONFIG: Record<string, SourceDisplayConfig> = {
  zapier: {
    label: "Zapier",
    icon: ZapierLogo,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-950/50",
  },
  make: {
    label: "Make",
    icon: MakeLogo,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-950/50",
  },
  n8n: {
    label: "n8n",
    icon: N8nLogo,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-950/50",
  },
  monday: {
    label: "monday.com",
    icon: MondayLogo,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-950/50",
  },
  windmill: {
    label: "Windmill",
    icon: Workflow,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-100 dark:bg-sky-950/50",
  },
  pipedream: {
    label: "Pipedream",
    icon: Zap,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-950/50",
  },
  "github-actions": {
    label: "GitHub Actions",
    icon: GitBranch,
    color: "text-gray-800 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
  },
  "power-automate": {
    label: "Power Automate",
    icon: Workflow,
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950/50",
  },
  temporal: {
    label: "Temporal",
    icon: Server,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-950/50",
  },
  prefect: {
    label: "Prefect",
    icon: Workflow,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950/50",
  },
  dagster: {
    label: "Dagster",
    icon: Workflow,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-950/50",
  },
  langchain: {
    label: "LangChain",
    icon: Bot,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-100 dark:bg-teal-950/50",
  },
  crewai: {
    label: "CrewAI",
    icon: Bot,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-950/50",
  },
  autogen: {
    label: "AutoGen",
    icon: Bot,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-950/50",
  },
  retool: {
    label: "Retool",
    icon: Code2,
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-950/50",
  },
  terraform: {
    label: "Terraform",
    icon: Cloud,
    color: "text-violet-700 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-950/50",
  },
  vercel: {
    label: "Vercel",
    icon: Rocket,
    color: "text-gray-900 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
  },
  netlify: {
    label: "Netlify",
    icon: Rocket,
    color: "text-teal-700 dark:text-teal-400",
    bgColor: "bg-teal-100 dark:bg-teal-950/50",
  },
  api: {
    label: "API",
    icon: Code2,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/50",
  },
};

/**
 * Resolve the display config for an approval request's source.
 * Priority: explicit source → connectionName → connection_id → generic fallback
 */
export function getSourceDisplay(
  approval: ApprovalRequest,
  connectionName?: string,
): SourceDisplayConfig {
  // 1. Explicit source field matches a known platform
  if (approval.source && SOURCE_CONFIG[approval.source]) {
    return SOURCE_CONFIG[approval.source];
  }

  // 2. Has a recognized source string we can fuzzy-match
  if (approval.source) {
    const lower = approval.source.toLowerCase();
    for (const [key, config] of Object.entries(SOURCE_CONFIG)) {
      if (lower.includes(key)) return config;
    }
    // Unknown but explicit source. Show as-is.
    return {
      label: approval.source,
      icon: Globe,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    };
  }

  // 3. Has a connection name (came via API key)
  if (connectionName) {
    return {
      label: connectionName,
      icon: Link2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    };
  }

  // 4. Has a connection_id but no name resolved
  if (approval.connection_id) {
    return {
      label: "API Connection",
      icon: Link2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    };
  }

  // 5. Fallback - generic integration
  return {
    label: "Integration",
    icon: Globe,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };
}

/**
 * Small inline badge showing source icon + label.
 */
export function SourceBadge({
  approval,
  connectionName,
  className,
}: {
  approval: ApprovalRequest;
  connectionName?: string;
  className?: string;
}) {
  const config = getSourceDisplay(approval, connectionName);
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn("flex items-center justify-center rounded size-4", config.bgColor)}>
        <Icon className={cn("size-2.5", config.color)} />
      </span>
      <span className="truncate">{config.label}</span>
    </span>
  );
}

/**
 * Slightly larger avatar-style icon for the source, used in card layouts.
 */
export function SourceAvatar({
  approval,
  connectionName,
  size = "sm",
}: {
  approval: ApprovalRequest;
  connectionName?: string;
  size?: "sm" | "md";
}) {
  const config = getSourceDisplay(approval, connectionName);
  const Icon = config.icon;

  const sizeClasses = size === "sm" ? "size-6 rounded" : "size-8 rounded-lg";
  const iconSize = size === "sm" ? "size-3.5" : "size-4.5";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        sizeClasses,
        config.bgColor,
      )}
    >
      <Icon className={cn(iconSize, config.color)} />
    </span>
  );
}
