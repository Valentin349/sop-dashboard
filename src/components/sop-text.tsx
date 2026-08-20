"use client";

import { Fragment, type ReactNode } from "react";

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
