"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FlaskConical, Webhook } from "lucide-react";

interface PlaygroundNavProps {
  isAdmin: boolean;
  mobile?: boolean;
}

const navItems: { id: string; label: string; href: string; icon: typeof FlaskConical; adminOnly?: boolean }[] = [
  { id: "builder", label: "Request Builder", href: "/playground/request-builder", icon: FlaskConical },
  { id: "deliveries", label: "Webhook Deliveries", href: "/playground/webhook-deliveries", icon: Webhook, adminOnly: true },
];

export function PlaygroundNav({ isAdmin, mobile }: PlaygroundNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (mobile) {
    return (
      <select
        value={visibleItems.find((i) => isActive(i.href))?.href ?? visibleItems[0]?.href}
        onChange={(e) => router.push(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      >
        {visibleItems.map((item) => (
          <option key={item.id} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <nav className="sticky top-0 pt-5 px-3">
      <div className="flex items-center gap-2 px-3 mb-2">
        <FlaskConical className="size-4 text-foreground" />
        <span className="text-sm font-semibold text-foreground">Playground</span>
      </div>
      <div className="space-y-0.5">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
