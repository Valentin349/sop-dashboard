"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { ISSUE_TYPES } from "@/lib/issues/types";
import type { ProductRow } from "@/lib/sops/types";
import { DRIVER_STATUS_TAGS, VEHICLE_TAGS } from "@/lib/sops/tags";
import { cn } from "@/lib/utils";
import { TagToggleGroup } from "./tag-controls";

// App-wide search bar for the Issue lists tab. Search + filters are platform-scoped (they span
// every category), so this lives in the top bar rather than inside the per-node issue list.
export function IssueSearchBar({
  query,
  onQueryChange,
  products,
  typeFilter,
  productFilter,
  vehicleFilter,
  statusFilter,
  onTypeFilter,
  onProductFilter,
  onVehicleFilter,
  onStatusFilter,
  resultCount,
  active,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  products: ProductRow[];
  typeFilter: string[];
  productFilter: number[];
  vehicleFilter: string[];
  statusFilter: string[];
  onTypeFilter: (next: string[]) => void;
  onProductFilter: (next: number[]) => void;
  onVehicleFilter: (next: string[]) => void;
  onStatusFilter: (next: string[]) => void;
  resultCount: number;
  active: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isMac, setIsMac] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters =
    typeFilter.length + productFilter.length + vehicleFilter.length + statusFilter.length;

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  useEffect(() => {
    if (!showFilters) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setShowFilters(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFilters(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showFilters]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function clearFilters() {
    onTypeFilter([]);
    onProductFilter([]);
    onVehicleFilter([]);
    onStatusFilter([]);
  }

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search issues, or #id"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          title="Filters"
          aria-label="Filters"
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-md border transition-colors hover:bg-accent",
            (showFilters || activeFilters > 0) && "bg-accent",
          )}
        >
          <SlidersHorizontal className="size-4" />
          {activeFilters > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-foreground text-[10px] font-bold tabular-nums text-background">
              {activeFilters}
            </span>
          )}
        </button>
        {active && (
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {showFilters && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 space-y-3 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md">
          <TagToggleGroup
            label="Issue type"
            options={ISSUE_TYPES.map((t) => ({ value: t, label: t }))}
            selected={typeFilter}
            onChange={(n) => onTypeFilter(n as string[])}
          />
          <TagToggleGroup
            label="Products"
            options={products.map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` }))}
            selected={productFilter}
            onChange={(n) => onProductFilter(n as number[])}
            emptyHint="No products."
          />
          <TagToggleGroup
            label="Vehicle"
            options={VEHICLE_TAGS.map((v) => ({ value: v, label: v }))}
            selected={vehicleFilter}
            onChange={(n) => onVehicleFilter(n as string[])}
          />
          <TagToggleGroup
            label="Driver status"
            options={DRIVER_STATUS_TAGS.map((v) => ({ value: v, label: v }))}
            selected={statusFilter}
            onChange={(n) => onStatusFilter(n as string[])}
          />
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
