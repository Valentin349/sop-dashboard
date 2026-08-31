"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

import type { PlatformRow } from "@/lib/sops/types";
import { monitorHref } from "@/lib/turns/nav";
import type { FlagCounts, TurnDetail, TurnFeedRow, TurnFlag } from "@/lib/turns/types";
import { cn } from "@/lib/utils";
import { TopBarCenter } from "./top-bar-center";
import { PlatformSwitcher } from "./platform-switcher";
import { FlagFilter } from "./monitor-flags";
import { MonitorFeed } from "./monitor-feed";
import { MonitorTurn } from "./monitor-turn";
import { MonitorTurnSkeleton } from "./skeletons";

// Stable empty array so the "no platform" render doesn't hand the memoized feed a new [] each time.
const NO_ROWS: TurnFeedRow[] = [];

export function MonitorDashboard({
  platforms,
  initialPlatformId,
  initialTurnId,
  initialFrom,
  initialTo,
  initialFlags,
  today,
  nowMs,
}: {
  platforms: PlatformRow[];
  initialPlatformId: number | null;
  initialTurnId: number | null;
  initialFrom: string;
  initialTo: string;
  initialFlags: TurnFlag[];
  today: string;
  // This request's clock, from the server. Never Date.now() in the browser — that is one of the
  // values React names as a hydration hazard, and it would drift between SSR and hydration.
  nowMs: number;
}) {
  const [platformId, setPlatformId] = useState(initialPlatformId);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [flags, setFlags] = useState<TurnFlag[]>(initialFlags);
  const [turnId, setTurnId] = useState(initialTurnId);

  const [rows, setRows] = useState<TurnFeedRow[]>([]);
  const [counts, setCounts] = useState<FlagCounts | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  // `loading` is set by whatever invalidates the feed (a filter change, refresh) and cleared by
  // the fetch that answers it. Setting it inside the effect body instead would cascade a second
  // render on every query change. It starts true for the fetch the mount effect is about to make.
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the refresh button to re-run the feed effect without changing the query, so there
  // is exactly one code path that fetches page 1 (and one that clears a stale error).
  const [nonce, setNonce] = useState(0);

  const [detail, setDetail] = useState<TurnDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(initialTurnId != null);

  // Only the newest feed request may write state — switching platform or range mid-flight would
  // otherwise let a slow earlier response overwrite the current one.
  const feedToken = useRef(0);
  const detailToken = useRef(0);

  const syncUrl = useCallback(
    (next: {
      platform?: number | null;
      turn?: number | null;
      from?: string;
      to?: string;
      flags?: TurnFlag[];
    }) => {
      window.history.replaceState(
        null,
        "",
        monitorHref({
          platform: next.platform !== undefined ? next.platform : platformId,
          turn: next.turn !== undefined ? next.turn : turnId,
          from: next.from ?? from,
          to: next.to ?? to,
          flags: next.flags ?? flags,
        }),
      );
    },
    [platformId, turnId, from, to, flags],
  );

  const params = useCallback(
    (pid: number, cursor?: number | null) => {
      const sp = new URLSearchParams({ platform: String(pid), from, to });
      if (flags.length > 0) sp.set("flags", flags.join(","));
      if (cursor != null) sp.set("cursor", String(cursor));
      return sp.toString();
    },
    [from, to, flags],
  );

  // Refetch the feed whenever the query that defines it changes. Counts come back with the first
  // page only, so they refresh here and not on "Load more".
  useEffect(() => {
    // Nothing to fetch without a platform. Bail rather than clearing state here — the render
    // derives the empty case below, and a setState in an effect body cascades a second render.
    if (platformId == null) return;
    const token = ++feedToken.current;

    fetch(`/api/turns?${params(platformId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (feedToken.current !== token) return;
        if (data.error) {
          setError(String(data.error));
          setRows([]);
          return;
        }
        setError(null);
        setRows(data.rows ?? []);
        setNextCursor(data.nextCursor ?? null);
        setCounts(data.counts ?? null);
      })
      .catch((e: Error) => {
        if (feedToken.current === token) setError(e.message);
      })
      .finally(() => {
        if (feedToken.current === token) setLoading(false);
      });
  }, [platformId, params, nonce]);

  // Load the selected turn's detail. Deep links land here on mount with a turn already chosen.
  useEffect(() => {
    // Deselection is derived at render, not written here (see the effect above).
    if (turnId == null) return;
    const token = ++detailToken.current;
    fetch(`/api/turns/${turnId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (detailToken.current !== token) return;
        setDetail(data.error ? null : (data as TurnDetail));
      })
      .catch(() => {
        if (detailToken.current === token) setDetail(null);
      })
      .finally(() => {
        if (detailToken.current === token) setDetailLoading(false);
      });
  }, [turnId]);

  const loadMore = useCallback(() => {
    if (platformId == null || nextCursor == null || loadingMore) return;
    const token = feedToken.current;
    setLoadingMore(true);
    fetch(`/api/turns?${params(platformId, nextCursor)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        // A filter change during the request invalidates this page entirely.
        if (feedToken.current !== token || data.error) return;
        setRows((prev) => [...prev, ...(data.rows ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      })
      .finally(() => {
        if (feedToken.current === token) setLoadingMore(false);
      });
  }, [platformId, nextCursor, loadingMore, params]);

  const selectPlatform = useCallback(
    (pid: number) => {
      setLoading(true);
      setPlatformId(pid);
      setTurnId(null);
      syncUrl({ platform: pid, turn: null });
    },
    [syncUrl],
  );

  const selectTurn = useCallback(
    (row: TurnFeedRow) => {
      setDetailLoading(true);
      setTurnId(row.id);
      syncUrl({ turn: row.id });
    },
    [syncUrl],
  );

  const changeFlags = useCallback(
    (next: TurnFlag[]) => {
      setLoading(true);
      setFlags(next);
      syncUrl({ flags: next });
    },
    [syncUrl],
  );

  const changeFrom = useCallback(
    (v: string) => {
      setLoading(true);
      setFrom(v);
      syncUrl({ from: v });
    },
    [syncUrl],
  );

  const changeTo = useCallback(
    (v: string) => {
      setLoading(true);
      setTo(v);
      syncUrl({ to: v });
    },
    [syncUrl],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  const platformName = platforms.find((p) => p.id === platformId)?.name ?? "Platform";

  // Derived views of the fetch state: without a platform there is no feed, and a turn that is no
  // longer selected keeps no stale detail on screen even though `detail` still holds it.
  const feedRows = platformId == null ? NO_ROWS : rows;
  const feedLoading = platformId != null && loading;
  const shownDetail = turnId == null ? null : detail;
  const shownDetailLoading = turnId != null && (detailLoading || detail?.turn.id !== turnId);

  return (
    <div className="flex h-full overflow-hidden text-foreground">
      <TopBarCenter>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => changeFrom(e.target.value)}
              className="rounded-md border bg-card px-2 py-1 text-[12px] text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => changeTo(e.target.value)}
              className="rounded-md border bg-card px-2 py-1 text-[12px] text-foreground"
            />
          </label>
          <FlagFilter
            selected={flags}
            counts={counts}
            onChange={changeFlags}
            loading={feedLoading}
          />
        </div>
      </TopBarCenter>

      {/* Left — the triage queue */}
      <aside className="flex h-full w-[340px] shrink-0 flex-col border-r bg-sidebar">
        <div className="space-y-2 p-3">
          <PlatformSwitcher
            platforms={platforms}
            currentId={platformId}
            onSelect={selectPlatform}
          />
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {counts ? `${counts.total} flagged` : "Flagged turns"}
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={feedLoading}
              title="Refresh from database"
              aria-label="Refresh from database"
              className="grid size-7 shrink-0 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", feedLoading && "animate-spin")} />
            </button>
          </div>
        </div>
        {error ? (
          <p className="px-4 py-3 text-[13px] text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <MonitorFeed
            rows={feedRows}
            selectedId={turnId}
            onSelect={selectTurn}
            onLoadMore={loadMore}
            hasMore={nextCursor != null}
            loading={feedLoading || loadingMore}
            now={nowMs}
          />
        )}
      </aside>

      {/* Right — the selected turn */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="min-h-0 flex-1">
          {shownDetailLoading ? (
            <MonitorTurnSkeleton />
          ) : shownDetail ? (
            <MonitorTurn detail={shownDetail} platformName={platformName} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <Activity className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="max-w-xs text-sm text-muted-foreground">
                Pick a flagged turn to see what the AI did, why it was flagged, and the
                conversation around it.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
