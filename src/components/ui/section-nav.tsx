"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SectionNavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface SectionNavProps {
  items: SectionNavItem[];
  defaultSection?: string;
  title?: string;
  titleIcon?: LucideIcon;
  children: (activeSection: string) => React.ReactNode;
}

export function SectionNav({ items, defaultSection, title, titleIcon: TitleIcon, children }: SectionNavProps) {
  const [active, setActive] = useState(defaultSection ?? items[0]?.id ?? "");

  return (
    <div className="flex w-full flex-col md:flex-row md:min-h-[calc(100vh-52px)]">
      {/* Left sidebar - desktop */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-border/40 bg-[var(--card)]">
        <nav className="sticky top-0 pt-5 px-3">
          {title && (
            <div className="flex items-center gap-2 px-3 mb-2">
              {TitleIcon && <TitleIcon className="size-4 text-foreground" />}
              <span className="text-sm font-semibold text-foreground">{title}</span>
            </div>
          )}
          <div className="space-y-0.5">
            {items.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition-colors text-left cursor-pointer",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-700 dark:text-emerald-400"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      isActive ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                    )}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* Mobile dropdown */}
      <div className="md:hidden border-b border-border/40 bg-background px-4 py-3">
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}{item.badge !== undefined ? ` (${item.badge})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          {children(active)}
        </div>
      </main>
    </div>
  );
}
