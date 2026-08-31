"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Highlighter, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

// Editor for a Postgres text[] column whose elements are single-line points — onboarding's
// `content` (the teaching script) and `final_checks`. One auto-growing box per point, so a long
// script reads as the list it is instead of as one wall of lines.
//
// Enter splits into a new point (no element may contain a newline — the column is read line by
// line downstream), Backspace on an empty point removes it, and pasting multi-line text spreads
// across points. Blank points are dropped on save, not while typing, so a half-written point
// doesn't vanish under the cursor.

function AutoTextArea({
  value,
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  inputRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Height follows the content. Layout effect so the first paint is already the right size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        inputRef(el);
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      rows={1}
      className="min-h-[38px] w-full resize-none overflow-hidden rounded-md border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    />
  );
}

export function PointsEditor({
  label,
  items,
  onChange,
  ordered = true,
  placeholder,
  addLabel = "Add point",
  hint,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  // content is a numbered script; final_checks is an unordered set of questions.
  ordered?: boolean;
  placeholder?: string;
  addLabel?: string;
  hint?: React.ReactNode;
}) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // Where to put the caret after a structural change (split, merge, move, add).
  const pending = useRef<{ index: number; caret?: "start" | "end" } | null>(null);

  useEffect(() => {
    const want = pending.current;
    if (!want) return;
    pending.current = null;
    const el = refs.current[want.index];
    if (!el) return;
    el.focus();
    const at = want.caret === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  }, [items]);

  const setAt = useCallback(
    (index: number, value: string) => {
      const next = [...items];
      next[index] = value;
      onChange(next);
    },
    [items, onChange],
  );

  // Append is separate from insertAfter: with no points yet, `items` is empty while the UI is
  // already showing one blank row, so the index to append after comes from the rendered rows.
  const addAtEnd = useCallback(
    (rowCount: number) => {
      const next = [...items];
      while (next.length < rowCount) next.push("");
      next.push("");
      pending.current = { index: next.length - 1, caret: "end" };
      onChange(next);
    },
    [items, onChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      pending.current = { index: Math.max(0, index - 1), caret: "end" };
      onChange(next.length ? next : [""]);
    },
    [items, onChange],
  );

  const move = useCallback(
    (index: number, delta: number) => {
      const to = index + delta;
      if (to < 0 || to >= items.length) return;
      const next = [...items];
      [next[index], next[to]] = [next[to], next[index]];
      pending.current = { index: to, caret: "end" };
      onChange(next);
    },
    [items, onChange],
  );

  // Wrap the selection (or the word at the caret) in ||…||, the markup for an on-screen label.
  const mark = useCallback(
    (index: number) => {
      const el = refs.current[index];
      if (!el) return;
      const { selectionStart: from, selectionEnd: to, value } = el;
      if (from === to) return;
      const marked = `${value.slice(0, from)}||${value.slice(from, to)}||${value.slice(to)}`;
      pending.current = { index, caret: "end" };
      setAt(index, marked);
    },
    [setAt],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const el = e.currentTarget;
    if (e.key === "Enter" && !e.shiftKey) {
      // Split at the caret: the tail becomes the next point.
      e.preventDefault();
      const head = el.value.slice(0, el.selectionStart);
      const tail = el.value.slice(el.selectionEnd);
      const next = [...items];
      next[index] = head;
      next.splice(index + 1, 0, tail);
      pending.current = { index: index + 1, caret: "start" };
      onChange(next);
      return;
    }
    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && index > 0) {
      // Merge into the previous point, caret at the seam.
      e.preventDefault();
      const prev = items[index - 1];
      const next = [...items];
      next[index - 1] = prev + el.value;
      next.splice(index, 1);
      pending.current = { index: index - 1, caret: "end" };
      onChange(next);
      // Restore the caret to the join, not the end of the merged text.
      const seam = prev.length;
      requestAnimationFrame(() => {
        const target = refs.current[index - 1];
        target?.setSelectionRange(seam, seam);
      });
      return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      move(index, e.key === "ArrowUp" ? -1 : 1);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>, index: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return; // let the browser handle a plain paste
    e.preventDefault();
    const el = e.currentTarget;
    const lines = text.split("\n").map((l) => l.trim());
    const head = el.value.slice(0, el.selectionStart);
    const tail = el.value.slice(el.selectionEnd);
    const next = [...items];
    next[index] = head + lines[0];
    const rest = lines.slice(1);
    rest[rest.length - 1] += tail;
    next.splice(index + 1, 0, ...rest);
    pending.current = { index: index + rest.length, caret: "end" };
    onChange(next);
  }

  const rows = items.length ? items : [""];

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <span className="text-[11px] text-muted-foreground">
          {rows.filter((r) => r.trim()).length} {ordered ? "steps" : "checks"}
        </span>
      </div>

      <div className="space-y-1.5">
        {rows.map((item, i) => (
          <div key={i} className="group flex items-start gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-right font-mono text-[12px] text-muted-foreground">
              {ordered ? i + 1 : "•"}
            </span>
            <div className="min-w-0 flex-1">
              <AutoTextArea
                value={item}
                onChange={(v) => setAt(i, v)}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPaste={(e) => onPaste(e, i)}
                placeholder={i === 0 ? placeholder : undefined}
                inputRef={(el) => {
                  refs.current[i] = el;
                }}
              />
            </div>
            {/* Row actions — visible on hover or while the row has focus. */}
            <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <RowButton
                title="Wrap the selection in ||…|| (an on-screen label)"
                onClick={() => mark(i)}
              >
                <Highlighter className="size-3.5" />
              </RowButton>
              <RowButton title="Move up (Ctrl+↑)" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="size-3.5" />
              </RowButton>
              <RowButton
                title="Move down (Ctrl+↓)"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
              >
                <ChevronDown className="size-3.5" />
              </RowButton>
              <RowButton title="Remove" onClick={() => removeAt(i)} destructive>
                <X className="size-3.5" />
              </RowButton>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addAtEnd(rows.length)}
        className="mt-2 ml-7 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </button>

      {hint && <p className="mt-2 ml-7 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RowButton({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent",
        destructive && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}
