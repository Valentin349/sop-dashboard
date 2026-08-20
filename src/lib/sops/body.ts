// Line-level structure of a SOP block body: numbered steps, sub-bullets, IF/WHEN/THEN
// conditions, and example replies. Presentation lives in components/sop-body.tsx; this file only
// classifies lines so it can be exercised without a DOM.

const STEP_RE = /^(\d+)\.[ \t]+(.*)$/;
const BULLET_RE = /^[-•*][ \t]+(.*)$/;
export const COND_RE = /^(IF|WHEN|THEN|AND|OR)\b/;
const REPLY_RE = /^example reply:/i;
const QUOTE = /["“”]/;

export type NodeHead =
  | { t: "step"; num: string; text: string }
  | { t: "bullet"; text: string }
  | { t: "cond"; text: string }
  | { t: "prose"; text: string }
  | { t: "reply"; text: string };

export type Node = NodeHead & { kids: Node[] };

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function minIndent(lines: string[]): number {
  let min = Infinity;
  for (const l of lines) if (l.trim()) min = Math.min(min, indentOf(l));
  return min === Infinity ? 0 : min;
}

export function trimBlankEdges(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

function countQuotes(s: string): number {
  return (s.match(/["“”]/g) ?? []).length;
}

// An example reply runs until its quotes balance, so a multi-line WhatsApp message — blank lines,
// bullet lines and all — stays one reply instead of being read as steps.
function takeReply(lines: string[], start: number): { text: string; end: number } {
  const first = lines[start].trim().replace(REPLY_RE, "").trim();
  let quotes = countQuotes(first);
  const buf = [first];
  let i = start + 1;
  if (first && quotes % 2 === 0) return { text: first, end: i };
  while (i < lines.length) {
    // Bound the damage from a reply whose quotes never close: a numbered step is never part of
    // the message, so stop there rather than swallowing the rest of the block.
    if (quotes % 2 === 1 && STEP_RE.test(lines[i].trim())) break;
    buf.push(lines[i].trim());
    quotes += countQuotes(lines[i]);
    i++;
    if (quotes > 0 && quotes % 2 === 0) break;
  }
  return { text: buf.join("\n").trim(), end: i };
}

function classify(s: string): NodeHead {
  const step = STEP_RE.exec(s);
  if (step) return { t: "step", num: step[1], text: step[2] };
  const bullet = BULLET_RE.exec(s);
  if (bullet) return { t: "bullet", text: bullet[1] };
  if (COND_RE.test(s)) return { t: "cond", text: s };
  return { t: "prose", text: s };
}

export function buildNodes(lines: string[]): Node[] {
  const base = minIndent(lines);
  const nodes: Node[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || indentOf(line) > base) {
      i++;
      continue;
    }
    if (REPLY_RE.test(line.trim())) {
      const { text, end } = takeReply(lines, i);
      nodes.push({ t: "reply", text, kids: [] });
      i = end;
      continue;
    }
    // Everything indented under this line belongs to it: sub-bullets, IF/THEN lines, a phone
    // number — one level of nesting, per the standard (§4.4).
    let j = i + 1;
    const kids: string[] = [];
    while (j < lines.length && (!lines[j].trim() || indentOf(lines[j]) > base)) {
      kids.push(lines[j]);
      j++;
    }
    nodes.push({ ...classify(line.trim()), kids: buildNodes(trimBlankEdges(kids)) });
    i = j;
  }
  return nodes;
}

// Split the collected reply into the WhatsApp bubbles it is written as. A message is quoted from
// the start of a line to the end of one, so quotes *inside* a message — app labels like "Ficar
// offline" — stay part of it instead of cutting it into pieces.
export function bubblesOf(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let open = false;

  const flush = () => {
    const t = cur.join("\n").trim();
    if (t) out.push(t);
    cur = [];
  };

  for (const raw of text.split("\n")) {
    let line = raw.trim();
    if (!open) {
      if (!line) continue;
      if (QUOTE.test(line[0])) {
        flush();
        open = true;
        line = line.slice(1);
      }
    }
    if (open && line.length > 0 && QUOTE.test(line[line.length - 1])) {
      cur.push(line.slice(0, -1));
      flush();
      open = false;
      continue;
    }
    cur.push(line);
  }
  flush();
  return out.length > 0 ? out : [text.trim()];
}
