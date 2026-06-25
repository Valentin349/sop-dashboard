"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookText } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Knowledge base", icon: BookText },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
] as const;

// Top-level switcher between the SOP knowledge base and the metrics view. The SOP dashboard keeps
// its state in window.history (pathname stays "/"), so an exact match flags it active; /metrics
// uses a prefix match.
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 rounded-lg border bg-card p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
