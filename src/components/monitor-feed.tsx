"use client";

import { memo } from "react";

import {
  flagDetails,
  headlineAddsDetail,
  summaryForTurn,
  type TurnFeedRow,
} from "@/lib/turns/types";
import { cn } from "@/lib/utils";
import { FlagBadge } from "./monitor-flags";

// Turns inside the last day are timestamped; older ones get the date, since the feed can span
// weeks and "14:32" alone would be ambiguous.
function formatWhen(iso: string, now: number): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (now - d.getTime() < 24 * 60 * 60 * 1000) return time;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

const TurnRowItem = memo(function TurnRowItem({
  row,
  active,
  now,
  onSelect,
}: {
  row: TurnFeedRow;
  active: boolean;
  now: number;
  onSelect: (row: TurnFeedRow) => void;
}) {
  const details = flagDetails(row);
  // On a gap or retry the headline would just restate the badge; there, the badges are the row.
  const headline = headlineAddsDetail(row) ? summaryForTurn(row) : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 84px" }}
      className={cn(
        "block w-full border-l-2 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-foreground bg-accent"
          : "border-transparent hover:bg-muted-foreground/20",
      )}
    >
      {headline && (
        <p
          className={cn(
            "mb-1.5 line-clamp-2 text-[13px] leading-snug",
            active ? "font-semibold text-foreground" : "font-medium text-foreground/90",
          )}
        >
          {headline}
        </p>
      )}
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {details.map((d) => (
          <FlagBadge key={d.flag} detail={d} />
        ))}
      </span>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        <span className="font-mono">{formatWhen(row.created_at, now)}</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span className="font-mono text-muted-foreground/70">#{row.id}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {row.ai_name ?? "unknown agent"}
        <span className="mx-1.5 opacity-40">·</span>
        conv {row.conversation_id ?? "—"}
      </p>
    </button>
  );
});

// Presentational list of already-filtered turns. Paging and selection live in the orchestrator;
// "Load more" is explicit rather than an infinite scroll, so a long triage session doesn't
// silently pull thousands of rows into the tab.
export const MonitorFeed = memo(function MonitorFeed({
  rows,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
  loading,
  now,
}: {
  rows: TurnFeedRow[];
  selectedId: number | null;
  onSelect: (row: TurnFeedRow) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  now: number;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          {loading ? "Loading…" : "No flagged turns in this range."}
        </p>
      ) : (
        <>
          {rows.map((row) => (
            <TurnRowItem
              key={row.id}
              row={row}
              active={row.id === selectedId}
              now={now}
              onSelect={onSelect}
            />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="mt-2 w-full rounded-md border py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
});
