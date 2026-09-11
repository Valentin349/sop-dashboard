"use client";

import type { TurnSummary } from "@/lib/turns/types";
import { cn } from "@/lib/utils";

// The range's numbers: the five indicators, the SOP-coverage table and the turn split.
// Same card and table vocabulary as the Metrics tab, so the two tabs read as one dashboard. It
// takes the main column whenever no turn is selected — the feed on the left is the queue, this
// is the period.
//
// Everything is counted in turns AND conversations: ten turns in one conversation are one
// signal, which is how the SOP gap report weighs evidence.

function n(value: number): string {
  return value.toLocaleString("en-GB");
}

// Sub-1% shares are the interesting ones here (4 escalations in 3,599 turns), so they keep a
// decimal instead of rounding to "0%".
function share(part: number, whole: number): string {
  if (whole <= 0) return "—";
  const p = (part / whole) * 100;
  if (p === 0) return "0%";
  return p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function KpiCard({
  title,
  value,
  sub,
  note,
}: {
  title: string;
  value: string;
  sub: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <span className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      {note && <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{note}</p>}
    </div>
  );
}

// The three verdicts. Emerald is the app's positive tone; the two SOP-gap rows keep the violet
// the tab already uses for that flag, so the colours agree with the badges in the feed. The pair
// clears CVD separation (ΔE 16.2 protan, 12.2 tritan) and every slice is directly labelled in
// the legend, which is the relief the low fill contrast asks for.
const VERDICTS = [
  {
    key: "covered" as const,
    label: "Covered",
    note: "the SOP answered",
    fill: "stroke-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    key: "partial" as const,
    label: "Partial",
    note: "right SOP, needed more",
    fill: "stroke-violet-400",
    dot: "bg-violet-400",
  },
  {
    key: "gap" as const,
    label: "Gap",
    note: "nothing usable reached the model",
    fill: "stroke-violet-600",
    dot: "bg-violet-600",
  },
];

// A donut of the turn split — the three verdicts are exclusive per turn, so they add to the
// turns the SOP agent judged. `pathLength={100}` lets the dash array be written straight
// in percent; the 1-unit gap between slices is the surface showing through, which is what keeps
// two adjacent violets readable as two slices.
const SLICE_GAP = 1;

function VerdictDonut({
  slices,
  total,
}: {
  slices: { key: string; value: number; fill: string }[];
  total: number;
}) {
  // Offsets resolved up front: each slice starts where the ones before it end.
  const arcs = slices.reduce<{ key: string; fill: string; length: number; offset: number }[]>(
    (acc, s) => {
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.length : 0;
      return [...acc, { key: s.key, fill: s.fill, length: (s.value / total) * 100, offset }];
    },
    [],
  );

  return (
    <svg viewBox="0 0 120 120" className="size-32 shrink-0 -rotate-90" role="img">
      {arcs.map(({ key, fill, length, offset }) => {
        if (length <= 0) return null;
        return (
          <circle
            key={key}
            cx="60"
            cy="60"
            r="48"
            fill="none"
            strokeWidth="16"
            pathLength={100}
            strokeDasharray={`${Math.max(0, length - SLICE_GAP)} ${100 - Math.max(0, length - SLICE_GAP)}`}
            strokeDashoffset={-offset}
            className={fill}
          />
        );
      })}
    </svg>
  );
}

export function MonitorSummary({
  summary,
  platformName,
  from,
  to,
}: {
  summary: TurnSummary;
  platformName: string;
  from: string;
  to: string;
}) {
  const range = from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  const checkedTurns = summary.scored.turns;

  // Headline number is the conversation count — a subject raised ten times in one thread is one
  // problem — with the turns, and the share of turns they are, in the sub-line. The two SOP
  // indicators are shares of the turns the SOP agent actually checked (it does not run on the
  // proactive agent, and on nothing before 2026-08-27); escalations and topic closures are shares
  // of every turn. The autonomous-off card counts switches, not a share.
  const cards: { title: string; value: string; sub: string; note?: string }[] = [
    {
      title: "No relevant SOP found",
      value: n(summary.missingSop.conversations),
      sub: `${n(summary.missingSop.turns)} turns · ${share(summary.missingSop.turns, checkedTurns)} of SOP-checked turns`,
    },
    {
      title: "Branch missing",
      value: n(summary.branchMissing.conversations),
      sub: `${n(summary.branchMissing.turns)} turns · ${share(summary.branchMissing.turns, checkedTurns)} of SOP-checked turns`,
    },
    {
      title: "Escalated to a human",
      value: n(summary.escalated.conversations),
      sub: `${n(summary.escalated.turns)} turns · ${share(summary.escalated.turns, summary.turns)} of turns`,
    },
    {
      title: "Topics closed by the AI",
      value: n(summary.resolvedTopics.turns),
      sub: `${share(summary.resolvedTopics.turns, summary.turns)} of turns · ${n(summary.resolvedTopics.conversations)} conversations`,
    },
    {
      // Headline is the number of switches — "how many times" is the question. Inferred from the
      // mode each turn ran in, so the note says it is a floor.
      title: "Autonomous turned off",
      value: n(summary.autonomousTurnedOff.turns),
      sub: `in ${n(summary.autonomousTurnedOff.conversations)} conversation${summary.autonomousTurnedOff.conversations === 1 ? "" : "s"}`,
      note: "Seen when the AI takes a later turn — a lower bound",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full px-8 py-8">
        <p className="text-xs text-muted-foreground">
          {platformName} · {range} · {n(summary.turns)} turns in {n(summary.conversations)}{" "}
          conversations
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {cards.map((c) => (
            <KpiCard key={c.title} {...c} />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">What happened</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Turns</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    Conversations
                  </th>
                </tr>
              </thead>
              <tbody>
                {VERDICTS.map((row, i) => {
                  const striped = i % 2 === 1;
                  const cells = [
                    n(summary[row.key].turns),
                    n(summary[row.key].conversations),
                  ];
                  return (
                    <tr key={row.key} className="group">
                      <td
                        className={cn(
                          "px-3 py-2 group-hover:bg-muted-foreground/30",
                          striped && "bg-muted-foreground/18",
                        )}
                      >
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-2 text-muted-foreground">({row.note})</span>
                      </td>
                      {cells.map((cell, c) => (
                        <td
                          key={c}
                          className={cn(
                            "px-3 py-2 text-right tabular-nums group-hover:bg-muted-foreground/30",
                            striped && "bg-muted-foreground/18",
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

          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Share of turns</p>
            {checkedTurns === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                The SOP agent checked no turn in this range.
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-4">
                <VerdictDonut
                  total={checkedTurns}
                  slices={VERDICTS.map((v) => ({
                    key: v.key,
                    value: summary[v.key].turns,
                    fill: v.fill,
                  }))}
                />
                <ul className="min-w-0 flex-1 space-y-2 text-xs">
                  {VERDICTS.map((v) => (
                    <li key={v.key} className="flex items-baseline gap-1.5">
                      <span className={cn("size-2 shrink-0 rounded-full", v.dot)} />
                      <span className="flex-1 whitespace-nowrap">{v.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {n(summary[v.key].turns)}
                      </span>
                      <span className="w-9 shrink-0 text-right font-medium tabular-nums">
                        {share(summary[v.key].turns, checkedTurns)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          The SOP agent checked {n(checkedTurns)} of {n(summary.turns)} turns, in{" "}
          {n(summary.scored.conversations)} conversations — it does not run on the proactive
          agent, and on no turn before 27 Aug 2026.
          {summary.acknowledgements.turns > 0 && (
            <>
              {" "}
              A further {n(summary.acknowledgements.turns)} turns are left out: the driver asked
              nothing (a thank-you, an “ok”), so the search came back empty on a turn no SOP was
              needed for.
            </>
          )}{" "}
          Turns are counted per verdict; conversations are filed under their worst turn, so the
          shares add to 100%.
        </p>
      </div>
    </div>
  );
}
