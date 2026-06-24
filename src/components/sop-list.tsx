"use client";

import { memo, useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { KnowledgeBaseRow } from "@/lib/sops/types";
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
  sop: KnowledgeBaseRow;
  active: boolean;
  onSelect: (sop: KnowledgeBaseRow) => void;
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
          "block text-[13px] leading-snug",
          active ? "font-semibold text-foreground" : "font-medium text-foreground/90",
        )}
      >
        {sop.title ?? "Untitled"}
      </span>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
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
  sops: KnowledgeBaseRow[];
  selectedId: number | null;
  onSelect: (sop: KnowledgeBaseRow) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sops;
    return sops.filter(
      (s) =>
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.content ?? "").toLowerCase().includes(q),
    );
  }, [sops, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-4 py-3">
        <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter procedures"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
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
