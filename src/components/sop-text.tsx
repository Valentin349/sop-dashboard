"use client";

import { Fragment, createContext, useContext, type ReactNode } from "react";

// The platform's variable values, for display only. The stored body holds {{TOKEN}}s — the
// substitution that reaches the driver happens once, at index-rebuild time — so the read view
// resolves them here to show what the SOP actually says.
const VariablesContext = createContext<Map<string, string>>(new Map());

export function VariablesProvider({
  values,
  children,
}: {
  values: Map<string, string>;
  children: ReactNode;
}) {
  return <VariablesContext.Provider value={values}>{children}</VariablesContext.Provider>;
}

const TOKEN_RE = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;

// Shows instantly on hover, unlike a native title. Sits inside the boxed value.
function Label({ text }: { text: string }) {
  return (
    <span className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-sans text-[11px] font-medium tracking-normal text-background shadow-sm group-hover:visible">
      {text}
    </span>
  );
}

// One run of body text: variables resolved and marked, everything else linkified. Resolving at
// the leaf rather than pre-rendering the whole body is what lets the value keep its identity —
// a reader can see which numbers are managed centrally instead of a flat string of digits.
export function Text({ value, whatsapp = false }: { value: string; whatsapp?: boolean }) {
  const values = useContext(VariablesContext);
  const inline = whatsapp ? whatsappText : linkify;

  // matchAll clones the regex internally, so the shared /g literal keeps no state between calls.
  const matches = [...value.matchAll(TOKEN_RE)];
  if (matches.length === 0) return <>{inline(value)}</>;

  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of matches) {
    const start = match.index;
    const name = match[1];
    if (start > last) out.push(<Fragment key={key++}>{inline(value.slice(last, start))}</Fragment>);
    const resolved = values.get(name);
    out.push(
      resolved == null ? (
        <span
          key={key++}
          className="group relative rounded-[3px] border border-destructive/50 bg-destructive/10 px-1 font-mono text-destructive"
        >
          {match[0]}
          <Label text={`No variable named ${name}`} />
        </span>
      ) : (
        // Boxed rather than underlined: an underline reads as a link in a body that has real
        // ones. The name shows on hover with no delay — a native title waits about a second,
        // which is long enough that you stop asking.
        <span
          key={key++}
          className="group relative rounded-[3px] border border-foreground/30 bg-foreground/[0.07] px-1"
        >
          {inline(resolved)}
          <Label text={name} />
        </span>
      ),
    );
    last = start + match[0].length;
  }
  if (last < value.length) out.push(<Fragment key={key++}>{inline(value.slice(last))}</Fragment>);
  return <>{out}</>;
}

// Turn bare URLs in plain-text content into clickable links, leaving everything else intact.
// Trailing sentence punctuation is kept out of the href so "see https://x.com." doesn't break.
const URL_RE = /(https?:\/\/[^\s<]+)/g;

export function linkify(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    let url = match[0];
    const trail = url.match(/[.,;:!?)\]}'"]+$/)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    if (start > last) out.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    out.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all hover:no-underline"
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}

// WhatsApp emphasis: an asterisk either side of the words (standard §5). Driver-facing text is
// sent verbatim, so show it the way the driver will see it rather than as literal asterisks.
const BOLD_RE = /\*([^*\n]+)\*/g;

export function whatsappText(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(BOLD_RE)) {
    const start = match.index;
    if (start > last) out.push(<Fragment key={key++}>{linkify(text.slice(last, start))}</Fragment>);
    out.push(<strong key={key++}>{linkify(match[1])}</strong>);
    last = start + match[0].length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{linkify(text.slice(last))}</Fragment>);
  return out;
}
