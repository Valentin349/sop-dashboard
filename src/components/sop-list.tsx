"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Search, SlidersHorizontal, X } from "lucide-react";

import type { SopWithMediaCount } from "@/lib/sops/queries";
import type { ProductRow } from "@/lib/sops/types";
import { DRIVER_STATUS_TAGS, VEHICLE_TAGS } from "@/lib/sops/tags";
import { cn } from "@/lib/utils";
import { TagToggleGroup } from "./tag-controls";

function preview(content: string | null): string {
  if (!content) return "";
  return content.replace(/\s+/g, " ").trim();
}

// Memoized row: with a stable `onSelect`, only rows whose `active` flips re-render — so
// selecting a SOP touches 2 rows, not the whole list.
const SopRow = memo(function SopRow({
  sop,
  active,
  onSelect,
}: {
  sop: SopWithMediaCount;
  active: boolean;
  onSelect: (sop: SopWithMediaCount) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(sop)}
      className={cn(
        "block w-full border-l-2 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-foreground bg-accent"
          : "border-transparent hover:bg-accent/60",
      )}
    >
      <span
        className={cn(
          "flex items-start justify-between gap-2 text-[13px] leading-snug",
          active ? "font-semibold text-foreground" : "font-medium text-foreground/90",
        )}
      >
        <span className="min-w-0">{sop.title ?? "Untitled"}</span>
        {sop.mediaCount > 0 && (
          <span
            title={`${sop.mediaCount} image${sop.mediaCount === 1 ? "" : "s"}`}
            className="mt-px flex shrink-0 items-center gap-0.5 text-[11px] font-normal tabular-nums text-muted-foreground"
          >
            <ImageIcon className="size-3" />
            {sop.mediaCount}
          </span>
        )}
      </span>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        <span className="font-mono text-muted-foreground/70">#{sop.id}</span>
        {sop.content && <span className="mx-1.5 opacity-40">·</span>}
        {preview(sop.content)}
      </p>
    </button>
  );
});

export const SopList = memo(function SopList({
  sops,
  selectedId,
  onSelect,
  products,
}: {
  sops: SopWithMediaCount[];
  selectedId: number | null;
  onSelect: (sop: SopWithMediaCount) => void;
  products: ProductRow[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [productFilter, setProductFilter] = useState<number[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const activeFilters =
    productFilter.length + vehicleFilter.length + statusFilter.length;

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A SOP matches a tag filter if it has no tags of that type (untagged = applies to ALL),
    // or it shares at least one selected value. Within a type: OR. Across types: AND.
    const matchesTag = (
      selected: Array<string | number>,
      tags: Array<string | number>,
    ) => selected.length === 0 || tags.length === 0 || tags.some((t) => selected.includes(t));

    return sops.filter((s) => {
      if (q) {
        const hit =
          String(s.id).includes(q) ||
          (s.title ?? "").toLowerCase().includes(q) ||
          (s.content ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return (
        matchesTag(productFilter, s.product_tags) &&
        matchesTag(vehicleFilter, s.vehicle_tags) &&
        matchesTag(statusFilter, s.driver_status_tags)
      );
    });
  }, [sops, query, productFilter, vehicleFilter, statusFilter]);

  function clearFilters() {
    setProductFilter([]);
    setVehicleFilter([]);
    setStatusFilter([]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter procedures or ID"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          title="Tag filters"
          aria-label="Tag filters"
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
      </div>

      {showFilters && (
        <div className="space-y-3 border-b px-4 pb-4">
          <TagToggleGroup
            label="Products"
            options={products.map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` }))}
            selected={productFilter}
            onChange={(n) => setProductFilter(n as number[])}
            emptyHint="No products."
          />
          <TagToggleGroup
            label="Vehicle"
            options={VEHICLE_TAGS.map((v) => ({ value: v, label: v }))}
            selected={vehicleFilter}
            onChange={(n) => setVehicleFilter(n as string[])}
          />
          <TagToggleGroup
            label="Driver status"
            options={DRIVER_STATUS_TAGS.map((v) => ({ value: v, label: v }))}
            selected={statusFilter}
            onChange={(n) => setStatusFilter(n as string[])}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No matching SOPs.</p>
        ) : (
          filtered.map((sop) => (
            <SopRow
              key={sop.id}
              sop={sop}
              active={sop.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
});
