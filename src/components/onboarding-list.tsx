"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";

import type { TopicIndexRow } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

// A curriculum: one product's ordered topics (or the platform-wide bucket, keyed "none").
export interface Curriculum {
  key: string;
  label: string;
  topics: TopicIndexRow[];
}

// Rows come from the nav index first, so a body may not be loaded yet — then there's no preview
// line to show and the row is just its step number and title.
function preview(topic: TopicIndexRow): string {
  const first = topic.content?.[0] ?? "";
  return first.replace(/\|\|/g, "").slice(0, 120).replace(/\s+/g, " ").trim();
}

// Column 1 body — the platform's products, each with its topic count.
export const ProductColumn = memo(function ProductColumn({
  curricula,
  selectedKey,
  onSelect,
}: {
  curricula: Curriculum[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {curricula.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No topics on this platform.</p>
      ) : (
        curricula.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
              c.key === selectedKey
                ? "bg-accent font-medium text-foreground"
                : "text-foreground/90 hover:bg-muted-foreground/20",
            )}
          >
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{c.topics.length}</span>
            <ChevronRight className="size-3.5 shrink-0 opacity-40" />
          </button>
        ))
      )}
    </div>
  );
});

const TopicRow = memo(function TopicRow({
  topic,
  active,
  showProduct,
  productLabel,
  onSelect,
}: {
  topic: TopicIndexRow;
  active: boolean;
  showProduct: boolean;
  productLabel: string;
  onSelect: (topic: TopicIndexRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(topic)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
      className={cn(
        "block w-full border-l-2 px-3 py-2.5 text-left transition-colors",
        active ? "border-foreground bg-accent" : "border-transparent hover:bg-muted-foreground/20",
      )}
    >
      <span
        className={cn(
          "flex items-start gap-2 text-[13px] leading-snug",
          active ? "font-semibold text-foreground" : "font-medium text-foreground/90",
        )}
      >
        <span className="mt-px w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
          {topic.order_index ?? "–"}
        </span>
        <span className="min-w-0">{topic.title ?? `Topic #${topic.id}`}</span>
      </span>
      <p className="mt-0.5 line-clamp-1 pl-7 text-xs text-muted-foreground">
        {showProduct && (
          <>
            <span className="text-muted-foreground/90">{productLabel}</span>
            <span className="mx-1.5 opacity-40">·</span>
          </>
        )}
        {preview(topic)}
      </p>
    </button>
  );
});

// Presentational list of already-filtered topics. Selection/search state lives in the dashboard.
export const TopicList = memo(function TopicList({
  topics,
  selectedId,
  onSelect,
  showProduct,
  productLabels,
}: {
  topics: TopicIndexRow[];
  selectedId: number | null;
  onSelect: (topic: TopicIndexRow) => void;
  // True in search mode, when rows can span products — then name each row's curriculum.
  showProduct: boolean;
  productLabels: Map<string, string>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {topics.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No matching topics.</p>
      ) : (
        topics.map((t) => (
          <TopicRow
            key={t.id}
            topic={t}
            active={t.id === selectedId}
            showProduct={showProduct}
            productLabel={
              productLabels.get(t.product_id == null ? "none" : String(t.product_id)) ?? "—"
            }
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
});
