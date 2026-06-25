"use client";

import { memo } from "react";
import { Flag, ImageIcon } from "lucide-react";

import type { SopWithMediaCount } from "@/lib/sops/queries";
import { cn } from "@/lib/utils";

function preview(content: string | null): string {
  if (!content) return "";
  // Only one clamped line shows, so clean a short slice instead of running the whitespace
  // regex over the full (multi-KB) body — this runs per row, so it matters for big categories.
  return content.slice(0, 140).replace(/\s+/g, " ").trim();
}

// Memoized row: with a stable `onSelect`, only rows whose `active` flips re-render — so
// selecting a SOP touches 2 rows, not the whole list.
const SopRow = memo(function SopRow({
  sop,
  active,
  categoryName,
  onSelect,
}: {
  sop: SopWithMediaCount;
  active: boolean;
  // Set only while searching, when results can span categories — shows where the SOP lives.
  categoryName?: string | null;
  onSelect: (sop: SopWithMediaCount) => void;
}) {
  const comeBack = sop.is_come_back === true;
  return (
    <button
      type="button"
      onClick={() => onSelect(sop)}
      // content-visibility skips layout/paint for offscreen rows — keeps 500+ row categories
      // snappy without a virtualization dep. The intrinsic size avoids scrollbar jump.
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
      className={cn(
        "block w-full border-l-2 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-foreground bg-accent"
          : comeBack
            ? "border-amber-400/80 bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-400/10 dark:hover:bg-amber-400/[0.16]"
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
        <span className="mt-px flex shrink-0 items-center gap-1.5">
          {comeBack && (
            <span
              title="Marked come-back"
              className="flex items-center text-amber-600 dark:text-amber-400"
            >
              <Flag className="size-3" />
            </span>
          )}
          {sop.mediaCount > 0 && (
            <span
              title={`${sop.mediaCount} image${sop.mediaCount === 1 ? "" : "s"}`}
              className="flex items-center gap-0.5 text-[11px] font-normal tabular-nums text-muted-foreground"
            >
              <ImageIcon className="size-3" />
              {sop.mediaCount}
            </span>
          )}
        </span>
      </span>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        <span className="font-mono text-muted-foreground/70">#{sop.id}</span>
        {categoryName && (
          <>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-muted-foreground/90">{categoryName}</span>
          </>
        )}
        {sop.content && <span className="mx-1.5 opacity-40">·</span>}
        {preview(sop.content)}
      </p>
    </button>
  );
});

// Presentational list of already-filtered SOPs. Search/filter state lives in the top bar
// (see SearchBar) and is resolved to `sops` by the dashboard.
export const SopList = memo(function SopList({
  sops,
  selectedId,
  onSelect,
  showCategory,
  categoryNameById,
}: {
  sops: SopWithMediaCount[];
  selectedId: number | null;
  onSelect: (sop: SopWithMediaCount) => void;
  // True while a platform-wide search/filter is active — rows then show their category.
  showCategory: boolean;
  categoryNameById: Map<number, string>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {sops.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No matching SOPs.</p>
      ) : (
        sops.map((sop) => (
          <SopRow
            key={sop.id}
            sop={sop}
            active={sop.id === selectedId}
            categoryName={
              showCategory && sop.category_id != null
                ? categoryNameById.get(sop.category_id)
                : undefined
            }
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
});
