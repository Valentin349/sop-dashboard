"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { diffLines } from "diff";
import { ArrowLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";

import type {
  ChangeKind,
  KnowledgeBaseRow,
  KnowledgeBaseVersionRow,
  ProductRow,
} from "@/lib/sops/types";
import { cn } from "@/lib/utils";
import { SopHistorySkeleton } from "./skeletons";

// Every kept version of the open SOP, newest first, with the selected one shown as a diff
// against the version before it — or against what the SOP says now. Takes the SOP's place in
// the main column the way the editor does, so the diff gets the full width. Restoring writes
// the old fields back through the normal save, so it shows up here as a new version at the top
// rather than rewinding the list (CLAUDE.md › Versions).
//
// The diff is over the authored text, placeholders included: that is what changed. A variable's
// value changing leaves no trace here, by design — the token stayed put.

const KIND_LABEL: Record<ChangeKind, string> = {
  create: "Created",
  edit: "Edited",
  variable_rename: "Variable renamed",
  restore: "Restored",
  baseline: "History started",
  pre_variables: "Before variables",
};

function kindLabel(kind: ChangeKind | null): string {
  if (kind == null) return "Edited outside the dashboard";
  return KIND_LABEL[kind] ?? kind;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// The fields a version snapshots. Both a version row and the live SOP row fit this shape.
type Snapshot = {
  title: string | null;
  content: string | null;
  category_id: number | null;
  is_come_back: boolean | null;
  product_tags: number[] | null;
  vehicle_tags: string[] | null;
  driver_status_tags: string[] | null;
};

type FieldChange = { label: string; from: string; to: string };

function sameList(a: readonly (string | number)[] | null, b: readonly (string | number)[] | null) {
  const x = [...(a ?? [])].sort().join(" ");
  const y = [...(b ?? [])].sort().join(" ");
  return x === y;
}

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    (a.title ?? "") === (b.title ?? "") &&
    (a.content ?? "") === (b.content ?? "") &&
    Number(a.category_id) === Number(b.category_id) &&
    Boolean(a.is_come_back) === Boolean(b.is_come_back) &&
    sameList(a.product_tags, b.product_tags) &&
    sameList(a.vehicle_tags, b.vehicle_tags) &&
    sameList(a.driver_status_tags, b.driver_status_tags)
  );
}

// Everything that changed apart from the body, as "label: from -> to" rows.
function fieldChanges(
  from: Snapshot,
  to: Snapshot,
  categoryName: (id: number | null) => string,
  productName: (id: number) => string,
): FieldChange[] {
  const out: FieldChange[] = [];
  const list = (items: readonly string[] | null) => (items?.length ? items.join(", ") : "All");
  if ((from.title ?? "") !== (to.title ?? "")) {
    out.push({
      label: "Title",
      from: from.title ?? "Untitled",
      to: to.title ?? "Untitled",
    });
  }
  if (Number(from.category_id) !== Number(to.category_id)) {
    out.push({
      label: "Category",
      from: categoryName(from.category_id),
      to: categoryName(to.category_id),
    });
  }
  if (Boolean(from.is_come_back) !== Boolean(to.is_come_back)) {
    out.push({
      label: "Come back",
      from: from.is_come_back ? "Yes" : "No",
      to: to.is_come_back ? "Yes" : "No",
    });
  }
  if (!sameList(from.product_tags, to.product_tags)) {
    out.push({
      label: "Products",
      from: list(from.product_tags?.map(productName) ?? null),
      to: list(to.product_tags?.map(productName) ?? null),
    });
  }
  if (!sameList(from.vehicle_tags, to.vehicle_tags)) {
    out.push({
      label: "Vehicle",
      from: list(from.vehicle_tags),
      to: list(to.vehicle_tags),
    });
  }
  if (!sameList(from.driver_status_tags, to.driver_status_tags)) {
    out.push({
      label: "Status",
      from: list(from.driver_status_tags),
      to: list(to.driver_status_tags),
    });
  }
  return out;
}

type Compare = "previous" | "current";

async function fetchVersions(id: number): Promise<KnowledgeBaseVersionRow[]> {
  const res = await fetch(`/api/sops/${id}/versions`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not load history");
  return data.versions ?? [];
}

export function SopHistory({
  sop,
  platformName,
  categoryName: openCategoryName,
  isAdmin,
  categoryNameById,
  products,
  onClose,
  onRestored,
}: {
  sop: KnowledgeBaseRow;
  platformName: string;
  categoryName: string;
  isAdmin: boolean;
  categoryNameById: Map<number, string>;
  products: ProductRow[];
  onClose: () => void;
  onRestored: (sop: KnowledgeBaseRow) => void;
}) {
  // Keyed by SOP so a switch shows the skeleton rather than the previous SOP's history, with
  // nothing to reset when the selection changes.
  const [loaded, setLoaded] = useState<{
    sopId: number;
    versions: KnowledgeBaseVersionRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // null = "the newest", so a background refresh that brings a new version shows it unless the
  // reader has clicked a specific one.
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [compare, setCompare] = useState<Compare>("previous");
  const [busy, setBusy] = useState(false);

  const sopId = sop.id;
  const versions = loaded != null && loaded.sopId === sopId ? loaded.versions : null;

  useEffect(() => {
    let active = true;
    fetchVersions(sopId).then(
      (list) => {
        if (!active) return;
        setLoaded({ sopId, versions: list });
        setError(null);
      },
      (e: Error) => {
        if (active) setError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, [sopId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const categoryName = useCallback(
    (id: number | null) => (id == null ? "None" : (categoryNameById.get(Number(id)) ?? `#${id}`)),
    [categoryNameById],
  );
  const productName = useCallback(
    (id: number) => products.find((p) => p.id === Number(id))?.name ?? `#${id}`,
    [products],
  );

  const pickedIndex = versions?.findIndex((v) => v.version_no === selectedNo) ?? -1;
  const selectedIndex = pickedIndex >= 0 ? pickedIndex : versions?.length ? 0 : -1;
  const selected = selectedIndex >= 0 ? versions![selectedIndex] : null;
  const previous = selectedIndex >= 0 ? (versions![selectedIndex + 1] ?? null) : null;
  const latestNo = versions?.[0]?.version_no ?? null;
  // "Current" means equal to the live row, not "newest in the list" — the two differ only if
  // something wrote to the row without the trigger recording it.
  const selectedIsCurrent = selected != null && sameSnapshot(selected, sop);

  // Diffs always read older -> newer.
  const pair = useMemo<{
    from: Snapshot;
    to: Snapshot;
    label: string;
  } | null>(() => {
    if (!selected) return null;
    if (compare === "current") {
      return {
        from: selected,
        to: sop,
        label: `v${selected.version_no} to now`,
      };
    }
    if (!previous) return null;
    return {
      from: previous,
      to: selected,
      label: `v${previous.version_no} to v${selected.version_no}`,
    };
  }, [selected, previous, sop, compare]);

  const changes = useMemo(
    () => (pair ? fieldChanges(pair.from, pair.to, categoryName, productName) : []),
    [pair, categoryName, productName],
  );

  async function restore() {
    if (!selected) return;
    if (
      !confirm(
        `Restore version ${selected.version_no}? The title, body, category and tags go back to how they were then. This is saved as a new version, so nothing is lost.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/sops/${sopId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_no: selected.version_no }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      onRestored(data.sop);
      const list = await fetchVersions(sopId);
      setLoaded({ sopId, versions: list });
      setSelectedNo(null);
      setNote(`Restored version ${selected.version_no}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb — same bar as the read view, with "History" as the last crumb */}
      <div className="flex items-center gap-1.5 border-b px-12 py-3 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span>{openCategoryName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="min-w-0 truncate">{sop.title ?? "Untitled"}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="font-medium text-foreground">History</span>
        {versions && (
          <span className="ml-1 text-[12px] tabular-nums">
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <ArrowLeft className="size-3.5" />
          Back to SOP
        </button>
      </div>

      {versions == null && !error ? (
        <SopHistorySkeleton />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Version list */}
          <nav aria-label="Versions" className="w-64 shrink-0 overflow-y-auto border-r">
            {versions && versions.length === 0 ? (
              <p className="px-4 py-6 text-[12px] leading-relaxed text-muted-foreground">
                No versions yet. The first save after history was switched on will appear here.
              </p>
            ) : (
              <ul className="py-1">
                {(versions ?? []).map((v) => {
                  const active = v.version_no === selected?.version_no;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNo(v.version_no);
                          setNote(null);
                        }}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 border-l-2 px-4 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          active ? "border-l-foreground bg-accent/60" : "border-l-transparent",
                        )}
                      >
                        <span className="flex w-full items-baseline gap-2">
                          <span className="font-mono text-[12px] font-semibold tabular-nums">
                            v{v.version_no}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px]">
                            {kindLabel(v.change_kind)}
                          </span>
                          {v.version_no === latestNo && (
                            <span className="shrink-0 rounded border px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Latest
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatWhen(v.changed_at)}
                        </span>
                        {v.changed_by && (
                          <span
                            className="max-w-full truncate text-[11px] text-muted-foreground"
                            title={v.changed_by}
                          >
                            {v.changed_by}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {/* Selected version */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="max-w-4xl space-y-4 px-12 py-8">
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

              {selected && (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className="font-mono text-[13px] font-semibold tabular-nums">
                      v{selected.version_no}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">
                      {kindLabel(selected.change_kind)}
                      {selected.changed_by ? ` · ${selected.changed_by}` : ""}
                      {` · ${formatWhen(selected.changed_at)}`}
                    </span>

                    <div
                      role="group"
                      aria-label="Compare with"
                      className="ml-auto inline-flex rounded-md border p-0.5 text-[11px]"
                    >
                      {(
                        [
                          ["previous", "vs previous"],
                          ["current", "vs now"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCompare(key)}
                          aria-pressed={compare === key}
                          className={cn(
                            "rounded px-2 py-0.5 transition-colors",
                            compare === key
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {isAdmin && !selectedIsCurrent && (
                      <button
                        type="button"
                        onClick={restore}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        Restore this version
                      </button>
                    )}
                  </div>

                  {selectedIsCurrent && (
                    <p className="text-[12px] text-muted-foreground">
                      This is what the SOP says now.
                    </p>
                  )}

                  {pair ? (
                    <>
                      {changes.length > 0 && (
                        <dl className="space-y-1 rounded-md border px-3 py-2 text-[12px]">
                          {changes.map((c) => (
                            <div key={c.label} className="flex flex-wrap items-baseline gap-x-2">
                              <dt className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                {c.label}
                              </dt>
                              <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                <del className="text-muted-foreground decoration-rose-500/60">
                                  {c.from}
                                </del>
                                <span className="text-muted-foreground" aria-hidden>
                                  &rarr;
                                </span>
                                <ins className="no-underline">{c.to}</ins>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <section>
                        <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Body &middot; {pair.label}
                        </h4>
                        <BodyDiff from={pair.from.content ?? ""} to={pair.to.content ?? ""} />
                      </section>
                    </>
                  ) : (
                    <section>
                      <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Body &middot; oldest version kept, shown in full
                      </h4>
                      <div className="font-serif text-[0.95rem] leading-[1.7] whitespace-pre-wrap break-words text-foreground/90">
                        {selected.content || (
                          <span className="italic text-muted-foreground">No content.</span>
                        )}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Unified line diff, the shape everyone knows from git: one row per line, a +/- gutter, whole
// lines added or removed. SOP bodies are short (a few dozen lines) so nothing is collapsed.
function BodyDiff({ from, to }: { from: string; to: string }) {
  const rows = useMemo(() => {
    const out: { kind: "add" | "del" | "same"; text: string }[] = [];
    for (const part of diffLines(from, to)) {
      const kind = part.added ? "add" : part.removed ? "del" : "same";
      const lines = part.value.split("\n");
      // A part that ends in a newline yields a trailing "" that is not a line of its own.
      if (lines[lines.length - 1] === "") lines.pop();
      for (const text of lines) out.push({ kind, text });
    }
    return out;
  }, [from, to]);

  if (!rows.some((r) => r.kind !== "same")) {
    return <p className="text-[12px] italic text-muted-foreground">Body unchanged.</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border font-mono text-[12.5px] leading-[1.6]">
      {rows.map((r, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            r.kind === "add" &&
              "bg-emerald-50 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-50",
            r.kind === "del" && "bg-rose-50 text-rose-950 dark:bg-rose-500/15 dark:text-rose-50",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "w-7 shrink-0 select-none border-r px-2 text-center",
              r.kind === "add" &&
                "border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300",
              r.kind === "del" &&
                "border-rose-200 text-rose-700 dark:border-rose-500/30 dark:text-rose-300",
              r.kind === "same" && "text-muted-foreground/50",
            )}
          >
            {r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words px-3">
            {r.text || " "}
          </span>
        </div>
      ))}
    </div>
  );
}
