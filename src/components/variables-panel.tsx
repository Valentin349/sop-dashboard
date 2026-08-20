"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { sopHref } from "@/lib/sops/nav";

import type { SopWithMediaCount } from "@/lib/sops/queries";
import type { KnowledgeBaseRow, SopVariableRow } from "@/lib/sops/types";
import { countToken, isValidVariableName } from "@/lib/sops/variables";
import { cn } from "@/lib/utils";

// Values SOP bodies reference as placeholders, edited in a slide-over rather than on their own
// page: you reach for a variable while reading a SOP, and a full navigation loses your place.
// Usage is derived from the corpus the dashboard already holds, so every variable can name the
// SOPs it appears in without a round trip.

const INPUT =
  "w-full rounded-md border bg-background px-2.5 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

type Draft = { id: number | null; name: string; value: string; description: string };
const BLANK: Draft = { id: null, name: "", value: "", description: "" };

export function VariablesPanel({
  open,
  onClose,
  platformId,
  variables,
  sops,
  isAdmin,
  onSelectSop,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  platformId: number | null;
  variables: SopVariableRow[];
  sops: SopWithMediaCount[];
  isAdmin: boolean;
  onSelectSop: (sop: KnowledgeBaseRow) => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  // variable name -> the SOPs using it, with how many times.
  const usage = useMemo(() => {
    const map = new Map<string, { sop: SopWithMediaCount; count: number }[]>();
    for (const v of variables) {
      const hits = [];
      for (const sop of sops) {
        const count = countToken(sop.content, v.name);
        if (count > 0) hits.push({ sop, count });
      }
      map.set(v.name, hits);
    }
    return map;
  }, [variables, sops]);

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
    setNote(null);
  }, []);

  async function save() {
    if (!draft || platformId == null) return;
    const name = draft.name.trim().toUpperCase();
    if (!isValidVariableName(name)) {
      setError("A name uses capitals, digits and underscores, and starts with a letter.");
      return;
    }
    if (!draft.value.trim()) {
      setError("Give the variable a value.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(
        draft.id == null ? "/api/variables" : `/api/variables/${draft.id}`,
        {
          method: draft.id == null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            draft.id == null
              ? { platform_id: platformId, name, value: draft.value, description: draft.description }
              : { name, value: draft.value, description: draft.description },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const renamedIn = typeof data.rewritten === "number" ? data.rewritten : 0;
      const valueChanged =
        draft.id != null && draft.value !== variables.find((v) => v.id === draft.id)?.value;
      setDraft(null);
      setNote(
        renamedIn > 0
          ? `Renamed. ${renamedIn} SOP${renamedIn === 1 ? "" : "s"} updated.`
          : valueChanged
            ? "Saved. The agent picks this up at the next index rebuild."
            : null,
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(v: SopVariableRow) {
    if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/variables/${v.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={() => !busy && onClose()}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Variables"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[26rem] max-w-[92vw] flex-col border-l bg-background shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Variables</h2>
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {variables.length}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setDraft(BLANK);
                setError(null);
                setNote(null);
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" />
              New
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !isAdmin && "ml-auto",
            )}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 p-4">
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
              >
                {error}
              </p>
            )}
            {note && (
              <p className="rounded-md border px-3 py-2 text-[12px] text-muted-foreground">
                {note}
              </p>
            )}

            {draft?.id == null && draft && (
              <DraftForm draft={draft} busy={busy} onChange={setDraft} onSave={save} onCancel={reset} />
            )}

            {variables.length === 0 && !draft ? (
              <p className="px-1 py-8 text-center text-[13px] leading-relaxed text-muted-foreground">
                No variables yet. A variable is a value that appears in more than one SOP — an
                earnings target, a waiting time, a phone model. Define it once, then type{" "}
                <kbd className="rounded border px-1 font-mono text-[11px]">/</kbd> in a SOP to
                drop it in.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {variables.map((v) =>
                  draft?.id === v.id ? (
                    <li key={v.id}>
                      <DraftForm
                        draft={draft}
                        busy={busy}
                        onChange={setDraft}
                        onSave={save}
                        onCancel={reset}
                      />
                    </li>
                  ) : (
                    <li key={v.id} className="rounded-lg border px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[12px] font-semibold">{v.name}</p>
                          <p className="mt-0.5 text-[13px]">{v.value}</p>
                        </div>
                        {isAdmin && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              title={`Edit ${v.name}`}
                              aria-label={`Edit ${v.name}`}
                              onClick={() => {
                                setDraft({
                                  id: v.id,
                                  name: v.name,
                                  value: v.value,
                                  description: v.description ?? "",
                                });
                                setError(null);
                                setNote(null);
                              }}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title={`Delete ${v.name}`}
                              aria-label={`Delete ${v.name}`}
                              disabled={busy}
                              onClick={() => remove(v)}
                              className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {v.description && (
                        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                          {v.description}
                        </p>
                      )}

                      <Usage
                        hits={usage.get(v.name) ?? []}
                        onSelect={(sop) => {
                          onSelectSop(sop);
                          onClose();
                        }}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// Which SOPs the variable appears in, by name — the question you actually have when changing a
// value is "what does this touch", not "how many". Same chip shape as the SOP links on an issue
// (issue-view.tsx), and a real href so middle-click and open-in-new-tab work; a plain click stays
// in place and just selects the SOP, since the panel is already inside the knowledge base.
function Usage({
  hits,
  onSelect,
}: {
  hits: { sop: SopWithMediaCount; count: number }[];
  onSelect: (sop: SopWithMediaCount) => void;
}) {
  if (hits.length === 0) {
    return <p className="mt-2 text-[11px] text-muted-foreground/70">Not used in any SOP</p>;
  }
  return (
    <div className="mt-2.5 border-t pt-2.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Used in
      </p>
      <div className="flex flex-col gap-1.5">
        {hits.map(({ sop, count }) => (
          <Link
            key={sop.id}
            href={sopHref({ platform: sop.platform_id, category: sop.category_id, sop: sop.id })}
            title={`Open SOP #${sop.id}`}
            onClick={(e) => {
              // Let the browser handle the modified clicks that mean "somewhere else".
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onSelect(sop);
            }}
            className="group inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              #{sop.id}
            </span>
            <span className="min-w-0 flex-1 truncate">{sop.title ?? "(untitled)"}</span>
            {count > 1 && (
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                ×{count}
              </span>
            )}
            <ArrowRight className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function DraftForm({
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  busy: boolean;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Name
        </span>
        <input
          value={draft.name}
          autoFocus
          placeholder="WEEKLY_EARNINGS_TARGET_CAR"
          onChange={(e) => onChange({ ...draft, name: e.target.value.toUpperCase() })}
          className={cn(INPUT, "font-mono")}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Value
        </span>
        <input
          value={draft.value}
          placeholder="350,000Kz"
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          className={INPUT}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          What it is
        </span>
        <input
          value={draft.description}
          placeholder="The weekly earnings goal we set for car drivers"
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className={INPUT}
        />
      </label>
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {draft.id == null ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-[12px] transition-colors hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
