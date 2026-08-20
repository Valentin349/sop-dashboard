// Structured reading/editing for SOPs written to the house standard
// (driver-context-manager/docs/agent/sop-writing-standard.md, mirrored in
// src/content/sop-writing-standard.md).
//
// The DB stores a SOP body as one plain-text blob and every word of it feeds the RAG index, so
// this module never rewrites wording — it only splits the blob into the standard's blocks and
// puts it back together with the standard's indentation. parse → serialize is a round trip for
// every SOP that follows the standard; the only drift is whitespace normalisation.
//
// Only the Anda corpus has been rewritten to the standard, so the structured UI is gated on the
// platform (see `platformSupportsStructure`). Other platforms keep the plain-text view/editor.

// Fixed set, fixed order (standard §2.2). "Location" / "Links" are the reference shape (§2.4).
export const BLOCK_ORDER = [
  "Driver says",
  "Environment",
  "Ask first",
  "Resolution",
  "Cause",
  "Location",
  "Links",
] as const;

export type BlockName = (typeof BLOCK_ORDER)[number];

// One-line reminder of what each block is for, shown under its heading in the editor.
export const BLOCK_HINTS: Record<BlockName, string> = {
  "Driver says": "Two to four real phrasings, in the driver's words. Don't repeat the title.",
  Environment: "The precise facts that make this the right SOP. One per line.",
  "Ask first": "What the agent must find out before choosing a branch. Procedures only.",
  Resolution: "What to do. Use branches when there is more than one path.",
  Cause: "Why it happens — only when the agent has to diagnose (§4.12).",
  Location: "Reference shape: floor, unit, landmark, opening times.",
  Links: "One bare web address per line.",
};

const BODY_INDENT = 2; // block body, relative to the block heading
const BRANCH_BODY_INDENT = 3; // branch body, relative to the branch label

const HEADER_RE = new RegExp(`^(${BLOCK_ORDER.join("|")})\\s*$`, "i");
const BRANCH_RE = /^([A-Z])\.[ \t]+(.*)$/;
const STEP_RE = /^(\d+)\.[ \t]+(.*)$/;

export interface Branch {
  key: string;
  label: string; // "A", "B", …
  condition: string; // the text after the label
  body: string; // steps and any example reply, dedented
}

export type SopBlock =
  | { name: "Driver says"; kind: "phrases"; phrases: string[] }
  | { name: "Ask first"; kind: "questions"; questions: string[] }
  | {
      name: "Resolution";
      kind: "resolution";
      intro: string; // steps/warnings before the first branch — the whole body when unbranched
      branches: Branch[];
      outro: string; // an "In both cases:" run after the last branch
    }
  | {
      name: "Environment" | "Cause" | "Location" | "Links";
      kind: "text";
      text: string;
    };

export interface SopDoc {
  // Anything before the first block heading. Empty for every SOP that follows the standard;
  // kept so a malformed one can still be opened and saved without losing text.
  preamble: string;
  blocks: SopBlock[];
  // Headings that appeared more than once. Their bodies are merged into one block rather than
  // dropped; the editor says so, so the writer can split or delete the extra text.
  duplicates: BlockName[];
}

let keySeq = 0;
export function newBranchKey(): string {
  return `br-${keySeq++}`;
}

// --- helpers ---------------------------------------------------------------------------------

function trimBlankEdges(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

// Remove up to `max` leading spaces from each line. Deeper nesting keeps its relative offset.
function dedent(lines: string[], max: number): string[] {
  return lines.map((l) => l.replace(new RegExp(`^ {1,${max}}`), ""));
}

function minIndent(lines: string[]): number {
  let min = Infinity;
  for (const l of lines) if (l.trim()) min = Math.min(min, indentOf(l));
  return min === Infinity ? 0 : min;
}

function indentBlock(text: string, n: number): string[] {
  const pad = " ".repeat(n);
  return text.split("\n").map((l) => (l.trim() ? pad + l : ""));
}

const QUOTE_CHARS = '"“”';

// Strip the wrapping quotes so the editor shows the phrase itself. Each end is handled on its
// own — some rows in the corpus are missing their closing quote, and re-quoting a half-quoted
// phrase would nest the quotes rather than repair them.
export function unquote(s: string): string {
  let t = s.trim();
  if (t.length > 1 && QUOTE_CHARS.includes(t[0])) t = t.slice(1);
  if (t.length > 0 && QUOTE_CHARS.includes(t[t.length - 1])) t = t.slice(0, -1);
  return t.trim();
}

function requote(s: string): string {
  const t = unquote(s);
  return t ? `"${t}"` : "";
}

// --- parse -----------------------------------------------------------------------------------

// Split a block body into numbered items. A line that is indented further than the number
// belongs to the item above it (a sub-bullet, an IF/THEN line, a phone number).
function parseNumbered(lines: string[]): string[] {
  const items: string[] = [];
  const buf: string[][] = [];
  for (const line of lines) {
    const m = indentOf(line) === 0 ? STEP_RE.exec(line.trim()) : null;
    if (m) {
      items.push(m[2]);
      buf.push([]);
    } else if (items.length > 0) {
      buf[buf.length - 1].push(line);
    } else if (line.trim()) {
      // Unnumbered text before the first number — keep it as its own item rather than drop it.
      items.push(line.trim());
      buf.push([]);
    }
  }
  return items.map((head, i) => {
    const rest = dedent(trimBlankEdges(buf[i]), BRANCH_BODY_INDENT);
    return rest.length > 0 ? `${head}\n${rest.join("\n")}` : head;
  });
}

function parseResolution(lines: string[]): Extract<SopBlock, { kind: "resolution" }> {
  const intro: string[] = [];
  const branches: Branch[] = [];
  const outro: string[] = [];

  let i = 0;
  // Everything up to the first branch label at column 0.
  while (i < lines.length && !(indentOf(lines[i]) === 0 && BRANCH_RE.test(lines[i]))) {
    intro.push(lines[i]);
    i++;
  }

  while (i < lines.length) {
    const m = BRANCH_RE.exec(lines[i]);
    if (indentOf(lines[i]) === 0 && m) {
      i++;
      const body: string[] = [];
      // The branch owns every following line that is indented under it (blank lines included).
      while (i < lines.length && (!lines[i].trim() || indentOf(lines[i]) > 0)) {
        body.push(lines[i]);
        i++;
      }
      const trimmed = trimBlankEdges(body);
      branches.push({
        key: newBranchKey(),
        label: m[1],
        condition: m[2].trim(),
        body: dedent(trimmed, minIndent(trimmed)).join("\n"),
      });
    } else {
      // A column-0 run after a branch — "In both cases:" and the steps that follow it.
      outro.push(lines[i]);
      i++;
    }
  }

  return {
    name: "Resolution",
    kind: "resolution",
    intro: trimBlankEdges(intro).join("\n"),
    branches,
    outro: trimBlankEdges(outro).join("\n"),
  };
}

function canonicalName(raw: string): BlockName {
  const lower = raw.trim().toLowerCase();
  return BLOCK_ORDER.find((b) => b.toLowerCase() === lower) as BlockName;
}

function makeBlock(name: BlockName, rawBody: string[]): SopBlock {
  const body = dedent(trimBlankEdges(rawBody), BODY_INDENT);
  switch (name) {
    case "Driver says":
      return {
        name,
        kind: "phrases",
        phrases: body.filter((l) => l.trim()).map(unquote),
      };
    case "Ask first":
      return { name, kind: "questions", questions: parseNumbered(body) };
    case "Resolution":
      return parseResolution(body);
    default:
      return { name, kind: "text", text: body.join("\n") };
  }
}

export function parseSop(content: string | null | undefined): SopDoc {
  const lines = (content ?? "").replace(/\r\n?/g, "\n").split("\n");

  const heads: number[] = [];
  lines.forEach((line, i) => {
    if (indentOf(line) === 0 && HEADER_RE.test(line)) heads.push(i);
  });

  const preamble = trimBlankEdges(lines.slice(0, heads[0] ?? lines.length)).join("\n");

  // Collect each heading's raw lines first. A repeated heading is a mistake in the source, but
  // dropping the second copy would delete its text on the next save, so append it to the first
  // and flag it instead.
  const bodies = new Map<BlockName, string[]>();
  const duplicates: BlockName[] = [];
  heads.forEach((start, n) => {
    const end = heads[n + 1] ?? lines.length;
    const name = canonicalName(lines[start]);
    const body = lines.slice(start + 1, end);
    const prev = bodies.get(name);
    if (prev) {
      if (!duplicates.includes(name)) duplicates.push(name);
      prev.push("", ...body);
    } else {
      bodies.set(name, body);
    }
  });

  return {
    preamble,
    blocks: BLOCK_ORDER.filter((b) => bodies.has(b)).map((b) => makeBlock(b, bodies.get(b)!)),
    duplicates,
  };
}

// --- serialize -------------------------------------------------------------------------------

function blockBody(block: SopBlock): string[] {
  switch (block.kind) {
    case "phrases":
      return block.phrases
        .map((p) => requote(p))
        .filter(Boolean)
        .map((p) => " ".repeat(BODY_INDENT) + p);

    case "questions": {
      const out: string[] = [];
      block.questions
        .filter((q) => q.trim())
        .forEach((q, i) => {
          const [head, ...rest] = q.split("\n");
          out.push(`${" ".repeat(BODY_INDENT)}${i + 1}. ${head.trim()}`);
          const tail = rest.join("\n");
          if (tail.trim()) out.push(...indentBlock(tail, BODY_INDENT + BRANCH_BODY_INDENT));
        });
      return out;
    }

    case "resolution": {
      const out: string[] = [];
      if (block.intro.trim()) out.push(...indentBlock(block.intro, BODY_INDENT));
      block.branches.forEach((br, i) => {
        if (out.length > 0) out.push("");
        const label = br.label || String.fromCharCode(65 + i);
        out.push(`${" ".repeat(BODY_INDENT)}${label}. ${br.condition.trim()}`);
        if (br.body.trim()) {
          out.push(...indentBlock(br.body, BODY_INDENT + BRANCH_BODY_INDENT));
        }
      });
      if (block.outro.trim()) {
        if (out.length > 0) out.push("");
        out.push(...indentBlock(block.outro, BODY_INDENT));
      }
      return out;
    }

    default:
      return block.text.trim() ? indentBlock(block.text, BODY_INDENT) : [];
  }
}

export function serializeSop(doc: SopDoc): string {
  const chunks: string[] = [];
  if (doc.preamble.trim()) chunks.push(doc.preamble.trimEnd());
  for (const block of doc.blocks) {
    const body = blockBody(block);
    // A section the writer opened and left empty would go into the index as a bare heading, and
    // every word of the body feeds the search entry (standard §1). Drop it.
    if (body.length === 0) continue;
    chunks.push([block.name, ...body].join("\n"));
  }
  return chunks.join("\n\n");
}

// --- editor helpers --------------------------------------------------------------------------

export function emptyBlock(name: BlockName): SopBlock {
  switch (name) {
    case "Driver says":
      return { name, kind: "phrases", phrases: [""] };
    case "Ask first":
      return { name, kind: "questions", questions: [""] };
    case "Resolution":
      return { name, kind: "resolution", intro: "", branches: [], outro: "" };
    default:
      return { name, kind: "text", text: "" };
  }
}

// Blocks always sit in the standard's order, whatever order they were added in.
export function withBlock(doc: SopDoc, block: SopBlock): SopDoc {
  const rest = doc.blocks.filter((b) => b.name !== block.name);
  const next = [...rest, block];
  return {
    ...doc,
    blocks: BLOCK_ORDER.flatMap((name) => next.filter((b) => b.name === name)),
  };
}

export function relabelBranches(branches: Branch[]): Branch[] {
  return branches.map((b, i) => ({ ...b, label: String.fromCharCode(65 + i) }));
}

// The structured UI is only correct for corpora rewritten to the standard.
const STRUCTURED_PLATFORM_CODES = new Set(["anda"]);

export function platformSupportsStructure(code: string | null | undefined): boolean {
  return code != null && STRUCTURED_PLATFORM_CODES.has(code.toLowerCase());
}
