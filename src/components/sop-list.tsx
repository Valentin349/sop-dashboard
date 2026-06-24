"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Search } from "lucide-react";

import type { SopWithMediaCount } from "@/lib/sops/queries";
import { cn } from "@/lib/utils";

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
}: {
  sops: SopWithMediaCount[];
  selectedId: number | null;
  onSelect: (sop: SopWithMediaCount) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);

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
    if (!q) return sops;
    return sops.filter(
      (s) =>
        String(s.id).toLowerCase().includes(q) ||
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.content ?? "").toLowerCase().includes(q),
    );
  }, [sops, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-4 py-3">
        <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter procedures or ID"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-12 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-7 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </div>

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
