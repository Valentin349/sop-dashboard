"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { SopVariableRow } from "@/lib/sops/types";
import { cn } from "@/lib/utils";

// Type-ahead insertion of {{TOKEN}}s. Typing "{" or "/" opens a menu at the caret that filters as
// you keep typing; Enter or Tab inserts. There is no always-visible list of variables — by the
// time you are writing a step you know what you want, and a standing list of 28 names is noise.

// "{" or "{{" anywhere; "/" only at a line start or after a space, so URLs and "and/or" stay quiet.
const BRACE = /\{\{?([A-Za-z0-9_]*)$/;
const SLASH = /(?:^|[\s(])(\/)([A-Za-z0-9_]*)$/;

export function findTrigger(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const brace = BRACE.exec(before);
  if (brace) return { start: brace.index, query: brace[1] };
  const slash = SLASH.exec(before);
  if (slash) return { start: slash.index + slash[0].indexOf("/"), query: slash[2] };
  return null;
}

export function rank(variables: SopVariableRow[], query: string): SopVariableRow[] {
  const q = query.toLowerCase();
  if (!q) return variables.slice(0, 8);
  const starts: SopVariableRow[] = [];
  const contains: SopVariableRow[] = [];
  for (const v of variables) {
    const name = v.name.toLowerCase();
    if (name.startsWith(q)) starts.push(v);
    else if (name.includes(q) || (v.description ?? "").toLowerCase().includes(q)) contains.push(v);
  }
  return [...starts, ...contains].slice(0, 8);
}

// Where the caret sits on screen. A mirror element carrying the field's own metrics is the only
// way to measure this — the platform exposes no caret rect for a textarea.
const MIRRORED = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
  "borderLeftWidth", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontStyle",
  "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontFamily", "lineHeight",
  "letterSpacing", "wordSpacing", "textIndent", "textTransform", "tabSize",
] as const;

export function caretPoint(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number,
): { top: number; left: number } {
  const computed = window.getComputedStyle(el);
  const isInput = el.nodeName === "INPUT";
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = isInput ? "pre" : "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  for (const prop of MIRRORED) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }

  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = el.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  const left = marker.offsetLeft;
  document.body.removeChild(mirror);

  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
  const box = el.getBoundingClientRect();
  return {
    top: box.top + top - el.scrollTop + lineHeight,
    left: box.left + left - el.scrollLeft,
  };
}

export function VariableMenu({
  variables,
  query,
  point,
  active,
  onActive,
  onPick,
}: {
  variables: SopVariableRow[];
  query: string;
  point: { top: number; left: number };
  active: number;
  onActive: (i: number) => void;
  onPick: (v: SopVariableRow) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  // Open upward when there is no room below.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setFlip(point.top + el.offsetHeight > window.innerHeight - 8);
  }, [point.top, variables.length]);

  useEffect(() => {
    ref.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (variables.length === 0) return null;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Variables"
      style={{
        top: flip ? undefined : point.top + 4,
        bottom: flip ? window.innerHeight - point.top + 18 : undefined,
        left: Math.min(point.left, Math.max(8, window.innerWidth - 320)),
      }}
      className="fixed z-50 max-h-64 w-[19rem] overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
    >
      {variables.map((v, i) => (
        <button
          key={v.id}
          type="button"
          role="option"
          aria-selected={i === active}
          data-active={i === active}
          onMouseEnter={() => onActive(i)}
          // mousedown, not click: click fires after the field has already lost focus.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(v);
          }}
          className={cn(
            "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left",
            i === active ? "bg-accent" : "hover:bg-accent/60",
          )}
        >
          <span className="truncate font-mono text-[12px]">{v.name}</span>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{v.value}</span>
        </button>
      ))}
      <p className="px-2 pt-1.5 pb-1 text-[10px] text-muted-foreground">
        {query ? `Matching “${query}”` : "Type to filter"} · Enter to insert
      </p>
    </div>
  );
}
