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
import type {
  KnowledgeBaseRow,
  ProductRow,
  SopMedia,
  SopVariableRow,
} from "@/lib/sops/types";
import { DRIVER_STATUS_TAGS, VEHICLE_TAGS } from "@/lib/sops/tags";
import { MAX_UPLOAD_BYTES, formatBytes, mediaTypeFor } from "@/lib/sops/media";
import { platformSupportsStructure } from "@/lib/sops/structure";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { TagToggleGroup } from "./tag-controls";
import { SopStructuredEditor } from "./sop-structured-editor";

type Mode = "edit" | "create";

// A media item as the editor holds it before anything is written to the DB. Existing items carry
// a DB `id` and a signed `url`; freshly added items carry the local `file` + an object-URL preview
// and have `id: null` until they're uploaded on Save.
type StagedMedia = {
  key: string;
  id: number | null;
  file: File | null;
  url: string;
  mediaType: "image" | "video";
  description: string;
};

// Route handlers return { error } JSON on failure (incl. 401/403 from the auth gate). Turn a
// non-2xx response into a thrown Error so callers surface it instead of silently doing nothing.
async function failIfNotOk(res: Response, fallback: string) {
  if (res.ok) return;
  const data = await res.json().catch(() => null);
  throw new Error(data?.error ?? `${fallback} (${res.status})`);
}

export function SopEditor({
  mode,
  sop,
  platformId,
  platformCode,
  categoryId,
  categories,
  products,
  variables,
  onOpenVariables,
  onCancel,
  onSaved,
  onDeleted,
  onDirtyChange,
}: {
  mode: Mode;
  sop: KnowledgeBaseRow | null;
  platformId: number;
  platformCode: string | null;
  categoryId: number | null;
  categories: CategoryWithCount[];
  products: ProductRow[];
  variables: SopVariableRow[];
  onOpenVariables?: () => void;
  onCancel: () => void;
  onSaved: (sop: KnowledgeBaseRow) => void;
  onDeleted: (id: number) => void;
  // Reports whether there are unsaved changes, so navigating away can ask first.
  onDirtyChange?: (dirty: boolean) => void;
}) {
  // The section-by-section editor only fits corpora written to the house standard — see
  // src/lib/sops/structure.ts. Everywhere else the body stays a plain textarea.
  const structured = platformSupportsStructure(platformCode);
  const [title, setTitle] = useState(sop?.title ?? "");
  const [content, setContent] = useState(sop?.content ?? "");
  const [catId, setCatId] = useState<number | null>(
    sop?.category_id ?? categoryId ?? categories[0]?.id ?? null,
  );
  const [isComeBack, setIsComeBack] = useState(sop?.is_come_back ?? false);
  const [productTags, setProductTags] = useState<number[]>(sop?.product_tags ?? []);
  const [vehicleTags, setVehicleTags] = useState<string[]>(sop?.vehicle_tags ?? []);
  const [statusTags, setStatusTags] = useState<string[]>(sop?.driver_status_tags ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking status shown while media uploads run (they can outlast a quick save).
  const [progress, setProgress] = useState<string | null>(null);

  // --- Media staging -------------------------------------------------------------------------
  // The editor edits media purely in local state; nothing is written until Save (see commitMedia).
  const [media, setMedia] = useState<StagedMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  // Existing rows the user removed in this session — deleted from the DB on Save.
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  // The media as it was loaded: captions so Save only PATCHes the ones actually edited, and the
  // order so a reorder counts as an unsaved change. State rather than refs — the unsaved-changes
  // check below runs during render, and refs must not be read there.
  const [loadedDesc, setLoadedDesc] = useState<Map<number, string>>(new Map());
  const [loadedOrder, setLoadedOrder] = useState<number[]>([]);
  // Object URLs minted for previews; revoked on unmount.
  const objectUrls = useRef<string[]>([]);
  const keySeq = useRef(0);

  // Load existing media for the SOP being edited.
  useEffect(() => {
    if (sop?.id == null) return;
    let cancelled = false;
    setMediaLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/media?sop=${sop.id}`, { cache: "no-store" });
        await failIfNotOk(res, "Failed to load media");
        const data = await res.json();
        if (cancelled) return;
        const items: StagedMedia[] = (data.media ?? []).map((m: SopMedia) => ({
          key: `db-${m.id}`,
          id: m.id,
          file: null,
          url: m.url,
          mediaType: m.mediaType === "video" ? "video" : "image",
          description: m.description ?? "",
        }));
        setLoadedDesc(new Map(items.map((it) => [it.id as number, it.description])));
        setLoadedOrder(items.map((it) => it.id as number));
        setMedia(items);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sop?.id]);

  useEffect(() => () => objectUrls.current.forEach(URL.revokeObjectURL), []);

  // --- Unsaved changes -----------------------------------------------------------------------
  // Snapshot of every editable field, captured on the first render and compared on each one.
  // The structured editor only writes on a real keystroke, so opening a SOP is never "dirty".
  const snapshot = JSON.stringify({
    title,
    content,
    catId,
    isComeBack,
    productTags: [...productTags].sort(),
    vehicleTags: [...vehicleTags].sort(),
    statusTags: [...statusTags].sort(),
  });
  // Captured on the first render and never updated — the editor unmounts after a save.
  const [baseline] = useState(snapshot);
  const mediaDirty =
    media.some((m) => m.file != null) ||
    removedIds.length > 0 ||
    media.some((m) => m.id != null && loadedDesc.get(m.id) !== m.description) ||
    media
      .filter((m) => m.id != null)
      .map((m) => m.id)
      .join(",") !== loadedOrder.join(",");
  const dirty = snapshot !== baseline || mediaDirty;

  // Tell the dashboard, so switching SOP / category / platform can ask before discarding. This
  // writes a ref there rather than state — the parent must not re-render on every keystroke.
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function cancel() {
    if (
      dirty &&
      !confirm(
        `Discard your changes to "${title.trim() || "this SOP"}"? Everything you have typed since opening it will be lost.`,
      )
    ) {
      return;
    }
    onCancel();
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Reject oversized files here rather than after the user has waited through an upload.
    const tooBig = Array.from(files).filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length > 0) {
      setError(
        `${tooBig.map((f) => `"${f.name}" (${formatBytes(f.size)})`).join(", ")} — over the ` +
          `${formatBytes(MAX_UPLOAD_BYTES)} per-file limit. Compress or trim before uploading.`,
      );
    }
    const added = Array.from(files)
      .filter((f) => f.size <= MAX_UPLOAD_BYTES)
      .map((file) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);
        return {
          key: `new-${keySeq.current++}`,
          id: null,
          file,
          url,
          mediaType: mediaTypeFor(file.type),
          description: "",
        } satisfies StagedMedia;
      });
    setMedia((prev) => [...prev, ...added]);
  }

  function removeItem(key: string) {
    setMedia((prev) => {
      const item = prev.find((m) => m.key === key);
      if (item?.id != null) setRemovedIds((ids) => [...ids, item.id as number]);
      if (item?.file) URL.revokeObjectURL(item.url);
      return prev.filter((m) => m.key !== key);
    });
  }

  function setDescription(key: string, description: string) {
    setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, description } : m)));
  }

  function moveItem(i: number, dir: -1 | 1) {
    setMedia((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Send one file's bytes straight from the browser to Supabase Storage, then record it.
  // Posting the file to /api/media instead would cap uploads at Vercel's hard 4.5MB request-body
  // limit (FUNCTION_PAYLOAD_TOO_LARGE), which no config setting can raise — too small for video.
  async function uploadFile(sopId: number, item: StagedMedia): Promise<number> {
    const file = item.file as File;
    const signRes = await fetch("/api/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sop: sopId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });
    await failIfNotOk(signRes, "Preparing upload failed");
    const ticket = await signRes.json();

    const supabase = createBrowserSupabase();
    const { error: upErr } = await supabase.storage
      .from(ticket.bucket)
      .uploadToSignedUrl(ticket.key, ticket.token, file, {
        contentType: file.type || undefined,
      });
    if (upErr) throw new Error(`Uploading "${file.name}" failed: ${upErr.message}`);

    const res = await fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sop: sopId,
        filename: ticket.filename,
        mediaType: ticket.mediaType,
        description: item.description,
      }),
    });
    await failIfNotOk(res, "Saving media failed");
    return Number((await res.json()).media);
  }

  // Apply the staged media changes to the DB for the (now-saved) SOP: delete removed rows, upload
  // new files (with their captions), patch edited captions, then persist the on-screen order.
  async function commitMedia(sopId: number) {
    for (const id of removedIds) {
      const res = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
      await failIfNotOk(res, "Removing media failed");
    }

    const pending = media.filter((m) => m.file).length;
    let done = 0;
    const finalIds: number[] = [];
    for (const item of media) {
      if (item.file) {
        // Videos take a while; say so rather than leaving the Save spinner unexplained.
        setProgress(`Uploading ${done + 1} of ${pending}…`);
        finalIds.push(await uploadFile(sopId, item));
        done++;
      } else if (item.id != null) {
        if (loadedDesc.get(item.id) !== item.description) {
          const res = await fetch("/api/media", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, description: item.description }),
          });
          await failIfNotOk(res, "Saving caption failed");
        }
        finalIds.push(item.id);
      }
    }

    if (finalIds.length > 1) {
      const res = await fetch("/api/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: finalIds }),
      });
      await failIfNotOk(res, "Reordering media failed");
    }
  }

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
    if (media.some((m) => !m.description.trim())) {
      setError("Add a description to every media item before saving.");
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
                product_tags: productTags,
                vehicle_tags: vehicleTags,
                driver_status_tags: statusTags,
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
                product_tags: productTags,
                vehicle_tags: vehicleTags,
                driver_status_tags: statusTags,
              }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      await commitMedia((data.sop as KnowledgeBaseRow).id);
      onSaved(data.sop);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
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
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
          <span className="truncate font-medium">
            {mode === "create" ? "New SOP" : `Editing ${sop?.title ?? `#${sop?.id}`}`}
          </span>
          {dirty && (
            <span className="shrink-0 rounded-[3px] border px-1.5 py-0.5 text-[11px]">
              Unsaved changes
            </span>
          )}
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
            onClick={cancel}
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
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
            >
              {error}
            </p>
          )}
          {progress && (
            <p className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {progress}
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

          {structured ? (
            <SopStructuredEditor
              value={content}
              onChange={setContent}
              variables={variables}
              onOpenVariables={onOpenVariables}
            />
          ) : (
            <Field label="Content">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="SOP content"
                className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            </Field>
          )}

          {/* Tagging is a separate job from writing the body — set it apart so the two don't
              read as one long form. */}
          <div className="space-y-5 border-t pt-8">
            <div>
              <p className="text-[13.5px] font-semibold">Tags</p>
              <p className="text-[12px] text-muted-foreground">
                Leave a tag type empty to apply the SOP to{" "}
                <span className="font-medium">all</span> of that type.
              </p>
            </div>
            <TagToggleGroup
              label="Product tags"
              options={products.map((p) => ({ value: p.id, label: p.name ?? `#${p.id}` }))}
              selected={productTags}
              onChange={(next) => setProductTags(next as number[])}
              emptyHint="No products for this platform."
            />
            <div className="flex flex-wrap gap-x-10 gap-y-6">
              <TagToggleGroup
                label="Vehicle tags"
                options={VEHICLE_TAGS.map((v) => ({ value: v, label: v }))}
                selected={vehicleTags}
                onChange={(next) => setVehicleTags(next as string[])}
              />
              <TagToggleGroup
                label="Driver status tags"
                options={DRIVER_STATUS_TAGS.map((v) => ({ value: v, label: v }))}
                selected={statusTags}
                onChange={(next) => setStatusTags(next as string[])}
              />
            </div>
          </div>

          <MediaManager
            mode={mode}
            items={media}
            loading={mediaLoading}
            disabled={saving || deleting}
            onAdd={addFiles}
            onRemove={removeItem}
            onDescription={setDescription}
            onMove={moveItem}
          />
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

// Staging UI only. Every change edits the parent's local state; the DB write happens on Save.
// Media attaches to an existing SOP, so in create mode we show a hint until the SOP is saved once.
function MediaManager({
  mode,
  items,
  loading,
  disabled,
  onAdd,
  onRemove,
  onDescription,
  onMove,
}: {
  mode: Mode;
  items: StagedMedia[];
  loading: boolean;
  disabled: boolean;
  onAdd: (files: FileList | null) => void;
  onRemove: (key: string) => void;
  onDescription: (key: string, description: string) => void;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (mode === "create") {
    return (
      <Field label="Media">
        <p className="rounded-md border border-dashed px-3 py-4 text-[13px] text-muted-foreground">
          Save the SOP first, then reopen it to add images or video.
        </p>
      </Field>
    );
  }

  return (
    <Field label={`Media${items.length ? ` (${items.length})` : ""}`}>
      <div className="space-y-2">
        <p className="text-[12px] text-muted-foreground">
          Changes are saved to the database when you click Save. Every item needs a description.
          Images and videos up to {formatBytes(MAX_UPLOAD_BYTES)} each.
        </p>
        {loading ? (
          <p className="text-[13px] text-muted-foreground">Loading media…</p>
        ) : (
          items.map((m, i) => (
            <div key={m.key} className="flex gap-3 rounded-md border p-2">
              <div className="size-20 shrink-0 overflow-hidden rounded bg-muted">
                {m.mediaType === "video" ? (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <textarea
                value={m.description}
                onChange={(e) => onDescription(m.key, e.target.value)}
                rows={2}
                placeholder="Description (required)"
                className="min-w-0 flex-1 resize-y rounded border bg-background px-2 py-1.5 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onMove(i, -1)}
                  disabled={disabled || i === 0}
                  title="Move up"
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, 1)}
                  disabled={disabled || i === items.length - 1}
                  title="Move down"
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(m.key)}
                  disabled={disabled}
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
          onChange={(e) => {
            onAdd(e.target.files);
            if (fileRef.current) fileRef.current.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" />
          Add image or video
        </button>
      </div>
    </Field>
  );
}
