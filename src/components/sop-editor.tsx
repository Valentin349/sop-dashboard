"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

import type { CategoryWithCount } from "@/lib/sops/queries";
import type { KnowledgeBaseRow, SopMedia } from "@/lib/sops/types";

type Mode = "edit" | "create";

export function SopEditor({
  mode,
  sop,
  platformId,
  categoryId,
  categories,
  onCancel,
  onSaved,
  onDeleted,
}: {
  mode: Mode;
  sop: KnowledgeBaseRow | null;
  platformId: number;
  categoryId: number | null;
  categories: CategoryWithCount[];
  onCancel: () => void;
  onSaved: (sop: KnowledgeBaseRow) => void;
  onDeleted: (id: number) => void;
}) {
  const [title, setTitle] = useState(sop?.title ?? "");
  const [content, setContent] = useState(sop?.content ?? "");
  const [catId, setCatId] = useState<number | null>(
    sop?.category_id ?? categoryId ?? categories[0]?.id ?? null,
  );
  const [isComeBack, setIsComeBack] = useState(sop?.is_come_back ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (catId == null) {
      setError("Pick a category.");
      return;
    }
    setSaving(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/sops", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform_id: platformId,
                category_id: catId,
                title,
                content,
                is_come_back: isComeBack,
              }),
            })
          : await fetch(`/api/sops/${sop!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                content,
                category_id: catId,
                is_come_back: isComeBack,
              }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.sop);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!sop) return;
    if (!confirm(`Delete "${sop.title ?? "this SOP"}" and its media? This can't be undone.`))
      return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sops/${sop.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      onDeleted(sop.id);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-12 py-3">
        <span className="text-[13px] font-medium text-muted-foreground">
          {mode === "create" ? "New SOP" : `Editing #${sop?.id}`}
        </span>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={remove}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="SOP title"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </Field>

          <div className="flex gap-4">
            <Field label="Category" className="flex-1">
              <select
                value={catId ?? ""}
                onChange={(e) => setCatId(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? `Category ${c.id}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Come-back" className="shrink-0">
              <label className="flex h-[38px] items-center gap-2 rounded-md border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={isComeBack}
                  onChange={(e) => setIsComeBack(e.target.checked)}
                  className="size-4"
                />
                <span className="text-muted-foreground">is_come_back</span>
              </label>
            </Field>
          </div>

          <Field label="Content">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="SOP content"
              className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </Field>

          <MediaManager mode={mode} sopId={sop?.id ?? null} />
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

// Media is attached to an existing SOP, so it can only be managed after a SOP exists.
// In create mode we show a hint instead. Each op hits the server immediately.
function MediaManager({ mode, sopId }: { mode: Mode; sopId: number | null }) {
  const [media, setMedia] = useState<SopMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/media?sop=${id}`, { cache: "no-store" });
      const data = await res.json();
      setMedia(data.media ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sopId != null) void load(sopId);
  }, [sopId]);

  if (mode === "create" || sopId == null) {
    return (
      <Field label="Media">
        <p className="rounded-md border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
          Save the SOP first, then reopen it to add images or video.
        </p>
      </Field>
    );
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || sopId == null) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("sop", String(sopId));
        form.set("file", file);
        await fetch("/api/media", { method: "POST", body: form });
      }
      await load(sopId);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del(id: number) {
    if (sopId == null) return;
    setBusy(true);
    try {
      await fetch(`/api/media?id=${id}`, { method: "DELETE" });
      await load(sopId);
    } finally {
      setBusy(false);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    setMedia(next);
    setBusy(true);
    try {
      await fetch("/api/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((m) => m.id) }),
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveDescription(id: number, description: string) {
    await fetch("/api/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, description }),
    });
  }

  return (
    <Field label={`Media${media.length ? ` (${media.length})` : ""}`}>
      <div className="space-y-2">
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading media…</p>
        ) : (
          media.map((m, i) => (
            <div key={m.id} className="flex gap-3 rounded-md border p-2">
              <div className="size-20 shrink-0 overflow-hidden rounded bg-muted">
                {m.mediaType === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <textarea
                defaultValue={m.description ?? ""}
                onBlur={(e) => void saveDescription(m.id, e.target.value)}
                rows={2}
                placeholder="Caption (saved on blur)"
                className="min-w-0 flex-1 resize-y rounded border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  title="Move up"
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={busy || i === media.length - 1}
                  title="Move down"
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => del(m.id)}
                  disabled={busy}
                  title="Remove"
                  className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => void upload(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          Add image or video
        </button>
      </div>
    </Field>
  );
}
