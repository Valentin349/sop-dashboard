"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, MessageSquareQuote, Plus, X } from "lucide-react";

import {
  BLOCK_HINTS,
  BLOCK_ORDER,
  emptyBlock,
  newBranchKey,
  parseSop,
  relabelBranches,
  serializeSop,
  withBlock,
  type BlockName,
  type Branch,
  type SopBlock,
  type SopDoc,
} from "@/lib/sops/structure";
import type { SopVariableRow } from "@/lib/sops/types";
import { token, tokensIn } from "@/lib/sops/variables";
import { VariableMenu, caretPoint, findTrigger, rank } from "./variable-menu";
import { cn } from "@/lib/utils";

// Section-by-section editor for SOPs written to the house standard. It is a controlled component
// over the same plain text the DB stores: every change re-serializes the whole body, so what is
// saved is always what the parser can read back. Nothing is written on mount — an untouched SOP
// keeps its stored text byte for byte.

const INPUT =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

// The last text box the writer was in, so an inserted token lands where the caret was. Shared
// through context rather than threaded as a prop through all six field editors — it is one piece
// of transient UI state that every one of them reports into.
type Focused = {
  el: HTMLTextAreaElement | HTMLInputElement;
  onChange: (v: string) => void;
} | null;

const FocusContext = createContext<((f: Focused) => void) | null>(null);

function useCaptureFocus() {
  const set = useContext(FocusContext);
  return (
    e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
    onChange: (v: string) => void,
  ) => set?.({ el: e.currentTarget, onChange });
}


function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const capture = useCaptureFocus();
  // Grow to fit rather than scroll inside a fixed box — a Resolution is read as a whole.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => capture(e, onChange)}
      className={cn(
        INPUT,
        "resize-none overflow-hidden font-mono text-[12.5px] leading-[1.65]",
        className,
      )}
    />
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
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
        "rounded p-1 transition-colors disabled:opacity-30",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TextButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      {children}
    </button>
  );
}

// Steps are numbered by hand in the text, so give the user one click to fix the sequence after
// inserting or deleting one. Only column-0 numbers move; continuation lines are left alone.
function renumber(text: string): string {
  let n = 0;
  return text
    .split("\n")
    .map((line) => {
      const m = /^(\d+)\.[ \t]+(.*)$/.exec(line);
      return m ? `${++n}. ${m[2]}` : line;
    })
    .join("\n");
}

function withExampleReply(text: string): string {
  const body = text.replace(/\s+$/, "");
  return `${body}${body ? "\n" : ""}Example reply: ""`;
}

function StepsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <IconButton title="Renumber the steps" onClick={() => onChange(renumber(value))}>
            <ListOrdered className="size-3.5" />
          </IconButton>
          <IconButton
            title="Add an example reply"
            onClick={() => onChange(withExampleReply(value))}
          >
            <MessageSquareQuote className="size-3.5" />
          </IconButton>
        </div>
      </div>
      <AutoTextarea value={value} onChange={onChange} placeholder={placeholder} rows={3} />
    </div>
  );
}

function BlockCard({
  block,
  onRemove,
  children,
}: {
  block: SopBlock;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-start gap-2 rounded-t-lg border-b bg-muted/40 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">{block.name}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {BLOCK_HINTS[block.name]}
          </p>
        </div>
        <IconButton title={`Remove ${block.name}`} onClick={onRemove} danger>
          <X className="size-3.5" />
        </IconButton>
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
    </div>
  );
}

function PhrasesEditor({
  phrases,
  onChange,
}: {
  phrases: string[];
  onChange: (next: string[]) => void;
}) {
  const capture = useCaptureFocus();
  const count = phrases.filter((p) => p.trim()).length;
  return (
    <>
      {phrases.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={p}
            placeholder="a real phrasing, in the driver's words"
            onChange={(e) => onChange(phrases.map((x, k) => (k === i ? e.target.value : x)))}
            onFocus={(e) =>
              capture(e, (v) => onChange(phrases.map((x, k) => (k === i ? v : x))))
            }
            className={INPUT}
          />
          <IconButton
            title="Remove phrasing"
            onClick={() => onChange(phrases.filter((_, k) => k !== i))}
            danger
          >
            <X className="size-3.5" />
          </IconButton>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <TextButton onClick={() => onChange([...phrases, ""])} icon={<Plus className="size-3" />}>
          Add phrasing
        </TextButton>
        <span
          className={cn(
            "text-[11px]",
            count >= 2 && count <= 4 ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500",
          )}
        >
          {count} of 2–4
        </span>
      </div>
    </>
  );
}

function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <>
      {questions.map((q, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="w-5 shrink-0 pt-2 text-right text-[12px] tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <AutoTextarea
            value={q}
            placeholder="a question the agent must ask to pick a branch"
            onChange={(v) => onChange(questions.map((x, k) => (k === i ? v : x)))}
            rows={1}
          />
          <IconButton
            title="Remove question"
            onClick={() => onChange(questions.filter((_, k) => k !== i))}
            danger
          >
            <X className="size-3.5" />
          </IconButton>
        </div>
      ))}
      <TextButton onClick={() => onChange([...questions, ""])} icon={<Plus className="size-3" />}>
        Add question
      </TextButton>
    </>
  );
}

function ResolutionEditor({
  block,
  onChange,
}: {
  block: Extract<SopBlock, { kind: "resolution" }>;
  onChange: (next: SopBlock) => void;
}) {
  const capture = useCaptureFocus();
  const branched = block.branches.length > 0;
  // The standard's shape is intro → branches (§2.3, §8); the parser supports a trailing run only
  // because some rows in the corpus have one. So the field appears for a SOP that already has
  // that text and there is no way to start a new one. Seeded once: driving it off the live value
  // would unmount the field the moment the writer cleared it, and off `branched` would hide text
  // that is still being saved.
  const [hasOutro] = useState(() => block.outro.trim() !== "");

  function setBranches(next: Branch[]) {
    onChange({ ...block, branches: relabelBranches(next) });
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= block.branches.length) return;
    const next = [...block.branches];
    [next[i], next[j]] = [next[j], next[i]];
    setBranches(next);
  }

  return (
    <>
      <StepsField
        label={branched ? "Steps before the branches" : "Steps"}
        value={block.intro}
        onChange={(intro) => onChange({ ...block, intro })}
        placeholder={"1. Start each step with a verb.\n2. Indent sub-bullets and IF/THEN lines under their step."}
      />

      {branched && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Branches are tried in order. Put the one with the worst consequences first.
        </p>
      )}

      {block.branches.map((br, i) => (
        <div key={br.key} className="rounded-md border bg-muted/30 p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded bg-foreground text-[11px] font-bold text-background">
              {br.label}
            </span>
            <input
              value={br.condition}
              placeholder="The order was cancelled before reaching the customer"
              onChange={(e) =>
                setBranches(
                  block.branches.map((x, k) =>
                    k === i ? { ...x, condition: e.target.value } : x,
                  ),
                )
              }
              onFocus={(e) =>
                capture(e, (v) =>
                  setBranches(
                    block.branches.map((x, k) => (k === i ? { ...x, condition: v } : x)),
                  ),
                )
              }
              className={INPUT}
            />
            <IconButton title="Move branch up" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="size-3.5" />
            </IconButton>
            <IconButton
              title="Move branch down"
              onClick={() => move(i, 1)}
              disabled={i === block.branches.length - 1}
            >
              <ArrowDown className="size-3.5" />
            </IconButton>
            <IconButton
              title="Remove branch"
              onClick={() => setBranches(block.branches.filter((_, k) => k !== i))}
              danger
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
          <StepsField
            label="Steps"
            value={br.body}
            placeholder={
              "1. Take a photo of the damage.\n2. Message Rider Support Chat.\n   IF Rider Support Chat has not replied\n   THEN message them again."
            }
            onChange={(body) =>
              setBranches(block.branches.map((x, k) => (k === i ? { ...x, body } : x)))
            }
          />
        </div>
      ))}

      <TextButton
        onClick={() =>
          setBranches([
            ...block.branches,
            { key: newBranchKey(), label: "", condition: "", body: "" },
          ])
        }
        icon={<Plus className="size-3" />}
      >
        Add branch
      </TextButton>

      {hasOutro && (
        <StepsField
          label="After the branches"
          value={block.outro}
          onChange={(outro) => onChange({ ...block, outro })}
        />
      )}
    </>
  );
}

// Anything the body references that has no variable behind it. Not a list of the variables — you
// insert those by typing "{" or "/", which opens a filtered menu at the caret.
function UnknownTokens({
  names,
  onOpenVariables,
}: {
  names: string[];
  onOpenVariables?: () => void;
}) {
  if (names.length === 0) return null;
  const one = names.length === 1;
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {names.map((n) => token(n)).join(", ")} {one ? "has" : "have"} no variable behind{" "}
      {one ? "it" : "them"}.{" "}
      {onOpenVariables && (
        <button
          type="button"
          onClick={onOpenVariables}
          className="underline underline-offset-2 hover:no-underline"
        >
          Create {one ? "it" : "them"}
        </button>
      )}{" "}
      or remove the placeholder — the SOP cannot be saved until then.
    </p>
  );
}

export function SopStructuredEditor({
  value,
  onChange,
  variables,
  onOpenVariables,
}: {
  value: string;
  onChange: (text: string) => void;
  variables: SopVariableRow[];
  onOpenVariables?: () => void;
}) {
  const [doc, setDoc] = useState<SopDoc>(() => parseSop(value));
  const [raw, setRaw] = useState(false);
  const focused = useRef<Focused>(null);
  const setFocused = useCallback((f: Focused) => {
    focused.current = f;
  }, []);

  const defined = new Set(variables.map((v) => v.name));
  const unknown = tokensIn(value).filter((t) => !defined.has(t));

  // The type-ahead menu: which field opened it, what has been typed since the trigger, and where
  // the caret was. Driven by delegated input/keydown on the wrapper so no field needs wiring.
  const [menu, setMenu] = useState<{
    start: number;
    query: string;
    point: { top: number; left: number };
  } | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef<number | null>(null);
  const matches = menu ? rank(variables, menu.query) : [];

  function fieldOf(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el || (el.nodeName !== "TEXTAREA" && el.nodeName !== "INPUT")) return null;
    return el as HTMLTextAreaElement | HTMLInputElement;
  }

  function refreshMenu(el: HTMLTextAreaElement | HTMLInputElement) {
    const caret = el.selectionStart ?? el.value.length;
    const trigger = variables.length > 0 ? findTrigger(el.value, caret) : null;
    if (!trigger) {
      setMenu(null);
      dismissed.current = null;
      return;
    }
    // Escape stays dismissed until the caret leaves that placeholder.
    if (dismissed.current === trigger.start) return;
    // Only reset the highlight when the query actually moved — otherwise every keystroke that
    // leaves the trigger alone would drag the selection back to the top.
    if (menu && menu.start === trigger.start && menu.query === trigger.query) return;
    setMenu({ ...trigger, point: caretPoint(el, trigger.start) });
    setActive(0);
  }

  function pick(name: string) {
    const f = focused.current;
    if (!f || !menu) return;
    dismissed.current = null;
    const { el, onChange: setField } = f;
    const caret = el.selectionStart ?? el.value.length;
    const next = el.value.slice(0, menu.start) + token(name) + el.value.slice(caret);
    setField(next);
    setMenu(null);
    const at = menu.start + token(name).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!menu || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(matches[active].name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      dismissed.current = menu.start;
      setMenu(null);
    }
  }

  function commit(next: SopDoc) {
    setDoc(next);
    onChange(serializeSop(next));
  }

  function replace(name: BlockName, block: SopBlock) {
    commit({ ...doc, blocks: doc.blocks.map((b) => (b.name === name ? block : b)) });
  }

  const missing = BLOCK_ORDER.filter((n) => !doc.blocks.some((b) => b.name === n));

  return (
    <FocusContext.Provider value={setFocused}>
      <div
        className="space-y-3"
        onInput={(e) => {
          const el = fieldOf(e.target);
          if (el) refreshMenu(el);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          // Caret moves that fire no input event. Up/Down are excluded on purpose: with the menu
          // open they drive the highlight, and refreshing here would reset it every press.
          if (!menu) return;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          const el = fieldOf(e.target);
          if (el) refreshMenu(el);
        }}
        onBlurCapture={() => setMenu(null)}
      >
        <div className="flex items-center justify-between gap-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Content
          </label>
          <button
            type="button"
            onClick={() => {
              // Coming back from plain text, re-read whatever was typed there.
              if (raw) setDoc(parseSop(value));
              setRaw(!raw);
            }}
            aria-pressed={raw}
            className="rounded-md border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {raw ? "Back to sections" : "Edit as plain text"}
          </button>
        </div>

          <UnknownTokens names={unknown} onOpenVariables={onOpenVariables} />

        {raw ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={24}
            className={cn(INPUT, "resize-y font-mono text-[12.5px] leading-relaxed")}
          />
        ) : (
          <>
            {doc.duplicates.length > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {doc.duplicates.map((d) => `"${d}"`).join(" and ")}{" "}
                {doc.duplicates.length > 1 ? "appear" : "appears"} twice in this SOP. Both copies
                are merged into one section here — check the order before you save.
              </p>
            )}

            {doc.preamble.trim() && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-800 dark:text-amber-500">
                  Before the first section
                </p>
                <AutoTextarea
                  value={doc.preamble}
                  onChange={(preamble) => commit({ ...doc, preamble })}
                />
                <p className="mt-1.5 text-[11px] text-amber-800/80 dark:text-amber-500/80">
                  Nothing goes before the first block (§2.2). Move this into a section or delete it.
                </p>
              </div>
            )}

            {doc.blocks.map((block) => (
              <BlockCard
                key={block.name}
                block={block}
                onRemove={() =>
                  commit({ ...doc, blocks: doc.blocks.filter((b) => b.name !== block.name) })
                }
              >
                {block.kind === "phrases" ? (
                  <PhrasesEditor
                    phrases={block.phrases}
                    onChange={(phrases) => replace(block.name, { ...block, phrases })}
                  />
                ) : block.kind === "questions" ? (
                  <QuestionsEditor
                    questions={block.questions}
                    onChange={(questions) => replace(block.name, { ...block, questions })}
                  />
                ) : block.kind === "resolution" ? (
                  <ResolutionEditor
                    block={block}
                    onChange={(next) => replace(block.name, next)}
                  />
                ) : (
                  <AutoTextarea
                    value={block.text}
                    onChange={(text) => replace(block.name, { ...block, text })}
                    rows={2}
                  />
                )}
              </BlockCard>
            ))}

            {missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Add section
                </span>
                {missing.map((name) => (
                  <TextButton
                    key={name}
                    onClick={() => commit(withBlock(doc, emptyBlock(name)))}
                    icon={<Plus className="size-3" />}
                  >
                    {name}
                  </TextButton>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {menu && matches.length > 0 && (
        <VariableMenu
          variables={matches}
          query={menu.query}
          point={menu.point}
          active={active}
          onActive={setActive}
          onPick={(v) => pick(v.name)}
        />
      )}
    </FocusContext.Provider>
  );
}
