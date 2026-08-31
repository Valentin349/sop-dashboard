"use client";

import { useState } from "react";
import { List, Loader2, Text, Trash2 } from "lucide-react";

import type { McqRow, OnboardingRow } from "@/lib/onboarding/types";
import type { ProductRow } from "@/lib/sops/types";
import { NO_PRODUCT, productIdFromKey, productKey } from "@/lib/onboarding/nav";
import { PointsEditor } from "./points-editor";

type Mode = "edit" | "create";

// Turn a non-2xx response (incl. 401/403 from the auth gate) into a thrown Error so save/delete
// surface it instead of silently doing nothing.
async function failIfNotOk(res: Response, fallback: string): Promise<unknown> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `${fallback} (${res.status})`);
  return data;
}

// text[] ⇆ plain lines, one array element per line. No stored element contains a newline
// (verified across the live corpus), so the round trip is lossless.
function toLines(items: string[]): string {
  return items.join("\n");
}
function fromLines(raw: string): string[] {
  return raw.split("\n").map((s) => s.trim());
}

// What gets saved: points trimmed, empties dropped (a half-written point is kept while editing).
function clean(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

function mcqLabel(m: McqRow): string {
  const q = (m.question ?? "").replace(/\s+/g, " ").trim();
  const head = m.topic ? `${m.topic} — ` : "";
  return `#${m.id} · ${head}${q.slice(0, 70)}${q.length > 70 ? "…" : ""}`;
}

export function OnboardingEditor({
  mode,
  topic,
  platformId,
  defaultProductKey,
  defaultOrderIndex,
  products,
  mcqs,
  onCancel,
  onSaved,
  onDeleted,
}: {
  mode: Mode;
  topic: OnboardingRow | null;
  platformId: number;
  // For a new topic: the curriculum the user is looking at, and the next free step number.
  defaultProductKey: string;
  defaultOrderIndex: number;
  products: ProductRow[];
  mcqs: McqRow[];
  onCancel: () => void;
  onSaved: (topic: OnboardingRow) => void;
  onDeleted: (id: number) => void;
}) {
  const [title, setTitle] = useState(topic?.title ?? "");
  const [product, setProduct] = useState(
    topic ? productKey(topic.product_id) : defaultProductKey,
  );
  const [orderIndex, setOrderIndex] = useState(
    String(topic?.order_index ?? defaultOrderIndex),
  );
  const [urgency, setUrgency] = useState(String(topic?.urgency ?? 4));
  const [content, setContent] = useState<string[]>(topic?.content ?? []);
  const [finalChecks, setFinalChecks] = useState<string[]>(topic?.final_checks ?? []);
  // Escape hatch: the same two lists as raw lines, for a bulk rewrite or a paste from elsewhere.
  const [plainMode, setPlainMode] = useState(false);
  const [additionalContext, setAdditionalContext] = useState(topic?.additional_context ?? "");
  const [mcqId, setMcqId] = useState(topic?.mcq_id != null ? String(topic.mcq_id) : "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numOrNull = (v: string) => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isInteger(n) ? n : null;
  };

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    for (const [label, value] of [
      ["Step", orderIndex],
      ["Urgency", urgency],
    ] as const) {
      if (value.trim() !== "" && numOrNull(value) == null) {
        setError(`${label} must be a whole number.`);
        return;
      }
    }

    const payload = {
      title: title.trim(),
      product_id: productIdFromKey(product),
      order_index: numOrNull(orderIndex),
      urgency: numOrNull(urgency),
      content: clean(content),
      final_checks: clean(finalChecks),
      additional_context: additionalContext,
      mcq_id: numOrNull(mcqId),
    };

    setSaving(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ platform_id: platformId, ...payload }),
            })
          : await fetch(`/api/onboarding/${topic!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = (await failIfNotOk(res, "Save failed")) as { topic: OnboardingRow };
      onSaved(data.topic);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!topic) return;
    if (!confirm(`Delete topic #${topic.id}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${topic.id}`, { method: "DELETE" });
      await failIfNotOk(res, "Delete failed");
      onDeleted(topic.id);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-12 py-3">
        <span className="text-[13px] font-medium text-muted-foreground">
          {mode === "create" ? "New topic" : `Editing #${topic?.id}`}
        </span>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || deleting}
            className="rounded-md border px-3 py-1.5 text-[13px] transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-4xl space-y-6 px-12 py-8">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <Field label="Title">
            <TextInput value={title} onChange={setTitle} placeholder="e.g. Essential apps setup" />
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field label="Product" className="min-w-56 flex-1">
              <Select value={product} onChange={setProduct}>
                <option value={NO_PRODUCT}>— all products —</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name ?? `#${p.id}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Step (order index)" className="min-w-32">
              <TextInput value={orderIndex} onChange={setOrderIndex} inputMode="numeric" />
            </Field>
            <Field label="Urgency" className="min-w-32">
              <TextInput value={urgency} onChange={setUrgency} inputMode="numeric" />
            </Field>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setPlainMode((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {plainMode ? <List className="size-3.5" /> : <Text className="size-3.5" />}
              {plainMode ? "Edit as points" : "Edit as plain lines"}
            </button>
          </div>

          {plainMode ? (
            <>
              <Field label="Content — one beat per line">
                <TextArea
                  value={toLines(content)}
                  onChange={(v) => setContent(fromLines(v))}
                  rows={12}
                />
              </Field>
              <Field label="Final checks — one per line">
                <TextArea
                  value={toLines(finalChecks)}
                  onChange={(v) => setFinalChecks(fromLines(v))}
                  rows={5}
                />
              </Field>
            </>
          ) : (
            <>
              <PointsEditor
                label="Content"
                items={content}
                onChange={setContent}
                placeholder="Explain that…"
                addLabel="Add step"
                hint={
                  <>
                    Enter starts the next step, Backspace at the start merges into the one above,
                    Ctrl+↑/↓ moves one. Wrap an on-screen label in{" "}
                    <span className="font-mono">||double pipes||</span> (or select it and hit the
                    highlighter).
                  </>
                }
              />
              <PointsEditor
                label="Final checks"
                items={finalChecks}
                onChange={setFinalChecks}
                ordered={false}
                placeholder="Ask them to confirm…"
                addLabel="Add check"
              />
            </>
          )}

          <Field label="Additional context">
            <TextArea value={additionalContext} onChange={setAdditionalContext} rows={5} />
          </Field>

          <Field label="Verification MCQ">
            <Select value={mcqId} onChange={setMcqId}>
              <option value="">— none —</option>
              {mcqs.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {mcqLabel(m)}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Questions and answers are authored in <span className="font-mono">comms.mcq</span>;
              only the link is editable here.
            </p>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={CONTROL}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`${CONTROL} resize-y font-mono text-[13px] leading-relaxed`}
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
      {children}
    </select>
  );
}
