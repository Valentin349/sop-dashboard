"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import type { PlatformRow } from "@/lib/sops/types";
import { cn } from "@/lib/utils";

function initials(p: PlatformRow): string {
  return (p.fleet_partner ?? p.name ?? p.code ?? "?").slice(0, 2).toUpperCase();
}

function displayName(p: PlatformRow): string {
  return p.name ?? p.code ?? `Platform ${p.id}`;
}

// Self-contained dropdown. The menu is absolutely positioned over the categories below it
// (it never participates in layout flow), so opening it can't push anything down.
export const PlatformSwitcher = memo(function PlatformSwitcher({
  platforms,
  currentId,
  onSelect,
}: {
  platforms: PlatformRow[];
  currentId: number | null;
  onSelect: (platformId: number) => void;
}) {
  const current = platforms.find((p) => p.id === currentId) ?? platforms[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
            {current ? initials(current) : "?"}
          </div>
          <span className="truncate text-sm font-medium">
            {current ? displayName(current) : "Select platform"}
          </span>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (p.id !== current?.id) onSelect(p.id);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                p.id === current?.id && "bg-accent/60",
              )}
            >
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                {initials(p)}
              </div>
              <span className="flex-1 truncate">{displayName(p)}</span>
              {p.id === current?.id && <Check className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
