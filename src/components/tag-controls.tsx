"use client";

import { cn } from "@/lib/utils";

export interface TagOption {
  value: string | number;
  label: string;
}

// One colour per tag dimension so the three kinds read apart at a glance.
export type TagTone = "product" | "vehicle" | "status" | "neutral";

const TONE_CHIP: Record<TagTone, string> = {
  product:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  vehicle:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  status:
    "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
  neutral: "bg-muted text-muted-foreground border-border",
};

const TONE_ACTIVE: Record<TagTone, string> = {
  product: "bg-blue-600 text-white border-blue-600",
  vehicle: "bg-emerald-600 text-white border-emerald-600",
  status: "bg-violet-600 text-white border-violet-600",
  neutral: "bg-foreground text-background border-foreground",
};

// Multi-select toggle chips for the editor and filters.
export function TagToggleGroup({
  label,
  options,
  selected,
  onChange,
  tone = "neutral",
  emptyHint,
}: {
  label: string;
  options: TagOption[];
  selected: Array<string | number>;
  onChange: (next: Array<string | number>) => void;
  tone?: TagTone;
  emptyHint?: string;
}) {
  function toggle(value: string | number) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {options.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{emptyHint ?? "No options."}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                aria-pressed={on}
                className={cn(
                  "rounded-[3px] border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  on
                    ? TONE_ACTIVE[tone]
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Read-only coloured chips for display.
export function TagChips({
  items,
  tone = "neutral",
  className,
}: {
  items: string[];
  tone?: TagTone;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-[3px] border px-2 py-0.5 text-[11px] font-medium",
            TONE_CHIP[tone],
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
