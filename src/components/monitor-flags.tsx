"use client";

import { cn } from "@/lib/utils";
import {
  FLAG_LABELS,
  TURN_FLAGS,
  type FlagCounts,
  type FlagDetail,
  type TurnFlag,
} from "@/lib/turns/types";

// One colour per failure signal, so a row's badges read at a glance and the filter chips above
// the feed match the badges inside it. Same chip vocabulary as tag-controls.tsx.
const FLAG_CHIP: Record<TurnFlag, string> = {
  escalated:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  invalid:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  retried:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  sop_gap:
    "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
};

const FLAG_ACTIVE: Record<TurnFlag, string> = {
  escalated: "bg-amber-600 text-white border-amber-600",
  invalid: "bg-red-600 text-white border-red-600",
  retried: "bg-orange-600 text-white border-orange-600",
  sop_gap: "bg-violet-600 text-white border-violet-600",
};

// A badge names the REASON, not the category — "Branch not in SOP", not "SOP gap". The category
// is carried by colour alone, which the filter chips above the feed teach; spelling it out on
// every row cost space and said nothing the colour didn't. `title` keeps the raw machine code
// (and the flag name) one hover away.
// Solid per-flag colour, for marks that are too small to carry the chip's border and background.
export const FLAG_DOT: Record<TurnFlag, string> = {
  escalated: "bg-amber-500",
  invalid: "bg-red-500",
  retried: "bg-orange-500",
  sop_gap: "bg-violet-500",
};

export function FlagBadge({
  detail,
  className,
}: {
  detail: FlagDetail;
  className?: string;
}) {
  return (
    <span
      title={detail.code ? `${FLAG_LABELS[detail.flag]} — ${detail.code}` : FLAG_LABELS[detail.flag]}
      className={cn(
        "inline-block max-w-full truncate rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium leading-normal",
        FLAG_CHIP[detail.flag],
        className,
      )}
    >
      {detail.label}
    </span>
  );
}

// The flag filter, doubling as the range's scoreboard. No selection means "every flag" — the
// same union the feed shows — so the chips render unselected rather than all-selected, and
// clicking one narrows from there.
export function FlagFilter({
  selected,
  counts,
  onChange,
  loading,
}: {
  selected: TurnFlag[];
  counts: FlagCounts | null;
  onChange: (next: TurnFlag[]) => void;
  loading: boolean;
}) {
  function toggle(flag: TurnFlag) {
    onChange(
      selected.includes(flag) ? selected.filter((f) => f !== flag) : [...selected, flag],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {TURN_FLAGS.map((flag) => {
        const on = selected.includes(flag);
        const n = counts?.[flag];
        return (
          <button
            key={flag}
            type="button"
            onClick={() => toggle(flag)}
            aria-pressed={on}
            title={`Show only ${FLAG_LABELS[flag].toLowerCase()} turns`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[11px] font-medium transition-colors",
              on ? FLAG_ACTIVE[flag] : cn(FLAG_CHIP[flag], "opacity-80 hover:opacity-100"),
            )}
          >
            {FLAG_LABELS[flag]}
            <span className={cn("font-mono tabular-nums", loading && "opacity-40")}>
              {n == null ? "—" : n}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-[3px] px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
