"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import type { PlatformRow } from "@/lib/sops/types";
import {
  METRIC_IDS,
  type MetricId,
  type MetricResponses,
  type AvgTimeToRespond,
  type AiAcceptanceRate,
  type MedianOutreach,
  type OutreachResponseRate,
  type ResponseRate,
  type SustainedEngagement,
} from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

// Which metrics honour the date range, and which honour the platform filter. The rest are
// "lifetime" aggregates the API computes ignoring both (outreach-response-rate, median-outreach).
const DATE_METRICS = new Set<MetricId>([
  "response-rate",
  "sustained-engagement",
  "avg-time-to-respond",
]);
const PLATFORM_METRICS = new Set<MetricId>([
  "response-rate",
  "sustained-engagement",
  "avg-time-to-respond",
  "ai-acceptance-rate",
]);

// The metrics that expose a per-agent × platform breakdown table.
const BREAKDOWN_METRICS: { id: MetricId; label: string }[] = [
  { id: "response-rate", label: "Response rate" },
  { id: "sustained-engagement", label: "Sustained engagement" },
  { id: "avg-time-to-respond", label: "Avg time to respond" },
  { id: "ai-acceptance-rate", label: "AI acceptance" },
];

type DataMap = Partial<{ [K in MetricId]: MetricResponses[K] }>;
type ErrMap = Partial<Record<MetricId, string>>;

// ── formatters ────────────────────────────────────────────────────────────────
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function fmtMinutes(m: number): string {
  // Always minutes — no rolling up to hours/days — so every response-time figure shares one unit.
  return `${m.toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
}

function platformLabel(p: PlatformRow): string {
  return p.name ?? p.code ?? `Platform ${p.id}`;
}

export function MetricsDashboard({
  platforms,
  today,
  defaultStart,
}: {
  platforms: PlatformRow[];
  // Both computed server-side (YYYY-MM-DD) so the initial range is identical at SSR and hydration.
  today: string;
  defaultStart: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(today);
  // Single platform selection (id) or "all". Defaults to the first platform so the initial load
  // queries one platform's data, not every platform at once — much faster to first paint.
  const [platform, setPlatform] = useState<number | "all">(
    () => platforms[0]?.id ?? "all",
  );
  const [nonce, setNonce] = useState(0);

  const [data, setData] = useState<DataMap>({});
  const [errors, setErrors] = useState<ErrMap>({});
  const [loading, setLoading] = useState(true);
  // Gate the Refresh button's `disabled` until after mount, so the initial client render matches
  // the server HTML exactly (no hydration mismatch on the attribute).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [breakdownId, setBreakdownId] = useState<MetricId>("response-rate");

  const fetchAll = useCallback(async () => {
    // Clear current results so the cards/table drop back to their shimmer state on EVERY fetch
    // (platform change, date change, refresh) — not just the first load.
    setLoading(true);
    setData({});
    setErrors({});
    const results = await Promise.all(
      METRIC_IDS.map(async (id) => {
        const p = new URLSearchParams({ metric: id });
        if (DATE_METRICS.has(id)) {
          p.set("start_date", start);
          p.set("end_date", end);
        }
        if (PLATFORM_METRICS.has(id) && platform !== "all") {
          p.append("platform_id", String(platform));
        }
        try {
          const res = await fetch(`/api/metrics?${p}`, { cache: "no-store" });
          const body = await res.json();
          if (!res.ok) {
            return { id, error: String(body?.error ?? `HTTP ${res.status}`) };
          }
          return { id, data: body };
        } catch (e) {
          return { id, error: (e as Error).message };
        }
      }),
    );
    const d: DataMap = {};
    const errs: ErrMap = {};
    for (const r of results) {
      if ("data" in r) (d as Record<string, unknown>)[r.id] = r.data;
      else errs[r.id] = r.error;
    }
    setData(d);
    setErrors(errs);
    setLoading(false);
  }, [start, end, platform]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, nonce]);

  const cards = useMemo(() => buildCards(data, errors), [data, errors]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Controls — date range, platform filter, refresh */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b bg-sidebar px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              From
            </span>
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-md border bg-card px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              To
            </span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-md border bg-card px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Platform
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {([{ id: "all" as const, label: "All" }, ...platforms.map((p) => ({ id: p.id, label: platformLabel(p) }))]).map(
              (opt) => {
                const active = platform === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPlatform(opt.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          disabled={mounted && loading}
          className="ml-auto flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", mounted && loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-2 px-0.5 text-[11px] text-muted-foreground">
          Cards tagged{" "}
          <span className="font-medium text-foreground">Period</span> follow the date range and
          platform filter; <span className="font-medium text-foreground">Lifetime</span> cards are
          computed across all data.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <KpiCard key={c.id} card={c} loading={loading && !data[c.id] && !errors[c.id]} />
          ))}
        </div>

        {/* Per-agent breakdown */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">By agent &amp; platform</h2>
            <div className="flex flex-wrap gap-1">
              {BREAKDOWN_METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setBreakdownId(m.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    breakdownId === m.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <BreakdownTable
            metricId={breakdownId}
            data={data}
            error={errors[breakdownId]}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────
type Scope = "Period" | "Lifetime";
interface Card {
  id: MetricId;
  title: string;
  scope: Scope;
  value: string;
  // Short label next to the headline number clarifying what statistic it is (e.g. "median").
  valueNote?: string;
  sub: string;
  target?: string;
  meets?: boolean;
  error?: string;
}

function buildCards(data: DataMap, errors: ErrMap): Card[] {
  const card = (id: MetricId, base: Omit<Card, "id" | "error">): Card => ({
    id,
    ...base,
    error: errors[id],
  });

  const rr = data["response-rate"] as ResponseRate | undefined;
  const se = data["sustained-engagement"] as SustainedEngagement | undefined;
  const at = data["avg-time-to-respond"] as AvgTimeToRespond | undefined;
  const or = data["outreach-response-rate"] as OutreachResponseRate | undefined;
  const ai = data["ai-acceptance-rate"] as AiAcceptanceRate | undefined;
  const mo = data["median-outreach"] as MedianOutreach | undefined;

  return [
    card("response-rate", {
      title: "Response rate",
      scope: "Period",
      value: rr ? fmtPct(rr.rate_pct) : "—",
      sub: rr
        ? `${fmtInt(rr.total_engaged_drivers)} / ${fmtInt(rr.total_coached_drivers)} drivers engaged`
        : "",
      target: rr ? `≥ ${rr.kpi_target_pct}%` : undefined,
      meets: rr?.meets_kpi,
    }),
    card("sustained-engagement", {
      title: "Sustained engagement",
      scope: "Period",
      value: se ? fmtPct(se.rate_pct) : "—",
      sub: se
        ? `${fmtInt(se.total_sustained_drivers)} / ${fmtInt(se.total_engaged_drivers)} sustained`
        : "",
      target: se ? `≥ ${se.kpi_target_pct}%` : undefined,
      meets: se?.meets_kpi,
    }),
    card("avg-time-to-respond", {
      title: "Response time",
      scope: "Period",
      value: at ? fmtMinutes(at.median_response_minutes) : "—",
      valueNote: "median",
      sub: at
        ? `mean ${fmtMinutes(at.mean_response_minutes)} · ${fmtInt(at.total_responded)} responses`
        : "",
      target: at ? `median ≤ ${fmtMinutes(at.kpi_target_minutes)}` : undefined,
      meets: at?.meets_kpi,
    }),
    card("outreach-response-rate", {
      title: "Outreach → conversation",
      scope: "Lifetime",
      value: or ? fmtPct(or.rate_pct) : "—",
      sub: or
        ? `${fmtInt(or.total_with_conversation)} / ${fmtInt(or.total_outreached)} outreached converted`
        : "",
      target: or ? `≥ ${or.kpi_target_pct}%` : undefined,
      meets: or?.meets_kpi,
    }),
    card("ai-acceptance-rate", {
      title: "AI acceptance rate",
      scope: "Lifetime",
      value: ai ? fmtPct(ai.acceptance_rate_pct) : "—",
      sub: ai
        ? `${fmtInt(ai.total_accepts)} / ${fmtInt(ai.total_suggests)} suggestions accepted`
        : "",
    }),
    card("median-outreach", {
      title: "Median outreach to response",
      scope: "Lifetime",
      value: mo ? `${fmtCount(mo.median_outreach_count)} msgs` : "—",
      sub: mo
        ? `mean ${fmtCount(mo.mean_outreach_count)} · max ${fmtInt(mo.max_outreach_count)} · ${fmtInt(mo.total_drivers)} drivers`
        : "",
      target: mo ? `≤ ${mo.kpi_target}` : undefined,
      meets: mo?.meets_kpi,
    }),
  ];
}

function KpiCard({ card, loading }: { card: Card; loading: boolean }) {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            card.scope === "Period"
              ? "bg-muted text-muted-foreground"
              : "bg-accent text-accent-foreground",
          )}
        >
          {card.scope}
        </span>
      </div>

      {card.error ? (
        <p className="mt-3 text-sm text-destructive">{card.error}</p>
      ) : loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-8 w-28 animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">
              {card.value}
            </span>
            {card.valueNote && (
              <span className="text-xs font-medium text-muted-foreground">
                {card.valueNote}
              </span>
            )}
            {card.meets != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  card.meets
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                {card.meets ? "On target" : "Below target"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
          {card.target && (
            <p className="mt-2 text-[11px] text-muted-foreground">Target {card.target}</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Breakdown table ───────────────────────────────────────────────────────────
// Column config per breakdown metric (header labels + index where the numeric, right-aligned
// columns begin). Shared by the real table AND its loading skeleton, so the shimmer lands exactly
// where each cell's data will be.
const BREAKDOWN_COLUMNS: Record<string, { headers: string[]; numericFrom: number }> = {
  "response-rate": {
    headers: ["Agent", "Platform", "Coached", "Engaged", "Rate"],
    numericFrom: 2,
  },
  "sustained-engagement": {
    headers: ["Agent", "Platform", "Engaged", "Sustained", "Rate"],
    numericFrom: 2,
  },
  "avg-time-to-respond": {
    headers: ["Agent", "Platform", "Type", "Responses", "Median", "Mean"],
    numericFrom: 3,
  },
  "ai-acceptance-rate": {
    headers: ["Agent", "Platform", "Convos", "Suggests", "Accepts", "Rejects", "Ignored", "Rate"],
    numericFrom: 2,
  },
};

// Alternating-row background. Uses muted-foreground at a real opacity step (NOT a bracketed
// decimal like /[0.06], which Tailwind reads as 0.06% — invisible). Visible as a flat fill in both
// light and dark; tune the number to taste.
const ZEBRA = "bg-muted-foreground/18";

// `group` indexes the agent×platform group a row belongs to. For most metrics that's just the row
// index (one row per group), but avg-time-to-respond has several message-type rows per group — the
// stripe alternates by `group` so each agent reads as one banded block, not row-by-row.
type Row = { key: string; cells: string[]; group: number };

function buildRows(metricId: MetricId, data: DataMap): Row[] | null {
  const agentName = (n: string | null) => n ?? "Unassigned";
  const platName = (n: string | null, id: number | null) => n ?? (id != null ? `#${id}` : "—");

  switch (metricId) {
    case "response-rate": {
      const d = data["response-rate"];
      if (!d) return null;
      return d.per_agent_platform.map((r, i) => ({
        key: `${r.agent_id}-${r.platform_id}-${i}`,
        group: i,
        cells: [
          agentName(r.agent_name),
          platName(r.platform_name, r.platform_id),
          fmtInt(r.total_coached_drivers),
          fmtInt(r.total_engaged_drivers),
          fmtPct(r.rate_pct),
        ],
      }));
    }
    case "sustained-engagement": {
      const d = data["sustained-engagement"];
      if (!d) return null;
      return d.per_agent_platform.map((r, i) => ({
        key: `${r.agent_id}-${r.platform_id}-${i}`,
        group: i,
        cells: [
          agentName(r.agent_name),
          platName(r.platform_name, r.platform_id),
          fmtInt(r.total_engaged_drivers),
          fmtInt(r.total_sustained_drivers),
          fmtPct(r.rate_pct),
        ],
      }));
    }
    case "avg-time-to-respond": {
      const d = data["avg-time-to-respond"];
      if (!d) return null;
      // One row per message type (sender_type) within each agent×platform group. The API returns
      // an "Overall" entry first, then per-type entries (agent, ai, system, performance_trigger).
      const rows: Row[] = [];
      d.per_agent_platform.forEach((r, gi) => {
        r.breakdown.forEach((b, bi) => {
          rows.push({
            key: `${r.agent_id}-${r.platform_id}-${gi}-${b.sender_type}`,
            group: gi, // all of an agent's type rows share one stripe
            cells: [
              // Agent/platform shown once per group (on the Overall row), blank on type sub-rows.
              bi === 0 ? agentName(r.agent_name) : "",
              bi === 0 ? platName(r.platform_name, r.platform_id) : "",
              b.sender_type,
              fmtInt(b.total_responded),
              fmtMinutes(b.median_response_minutes),
              fmtMinutes(b.mean_response_minutes),
            ],
          });
        });
      });
      return rows;
    }
    case "ai-acceptance-rate": {
      const d = data["ai-acceptance-rate"];
      if (!d) return null;
      return d.per_agent_platform.map((r, i) => ({
        key: `${r.agent_id}-${r.platform_id}-${i}`,
        group: i,
        cells: [
          agentName(r.agent_name),
          platName(r.platform_name, r.platform_id),
          fmtInt(r.conversations),
          fmtInt(r.suggests),
          fmtInt(r.accepts),
          fmtInt(r.rejects),
          fmtInt(r.ignored),
          fmtPct(r.acceptance_rate_pct),
        ],
      }));
    }
    default:
      return null;
  }
}

function BreakdownTable({
  metricId,
  data,
  error,
  loading,
}: {
  metricId: MetricId;
  data: DataMap;
  error?: string;
  loading: boolean;
}) {
  const col = BREAKDOWN_COLUMNS[metricId];
  const rows = buildRows(metricId, data);

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-destructive">{error}</div>
    );
  }
  if (!col) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No data.
      </div>
    );
  }
  // rows === null → this metric's data hasn't loaded yet.
  if (rows === null) {
    return loading ? (
      <BreakdownTableSkeleton metricId={metricId} />
    ) : (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No data.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No rows for this selection.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {col.headers.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  i >= col.numericFrom && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Alternating colours by agent group (so an agent's message-type rows band together).
              The stripe is applied per-cell because cell backgrounds render reliably. */}
          {rows.map((row) => {
            const striped = row.group % 2 === 1;
            return (
              <tr key={row.key} className="group">
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-2 group-hover:bg-muted-foreground/30",
                      striped && ZEBRA,
                      i >= col.numericFrom ? "text-right tabular-nums" : "truncate",
                      i === 0 && "font-medium",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Loading skeleton that mirrors the real table: same headers and columns, with cell-shaped shimmer
// sitting exactly where each value will land (not a generic full-width bar).
function BreakdownTableSkeleton({ metricId }: { metricId: MetricId }) {
  const col = BREAKDOWN_COLUMNS[metricId];
  if (!col) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {col.headers.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  i >= col.numericFrom && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, r) => (
            <tr key={r}>
              {col.headers.map((_, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2",
                    r % 2 === 1 && ZEBRA,
                    i >= col.numericFrom && "text-right",
                  )}
                >
                  <div
                    className={cn(
                      "h-3.5 animate-pulse rounded bg-muted-foreground/20",
                      i >= col.numericFrom
                        ? "ml-auto w-12" // numeric: narrow, right-aligned
                        : i === 0
                          ? "w-24" // first label column: wider
                          : "w-16",
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
