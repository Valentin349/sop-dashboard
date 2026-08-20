"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Braces, ChevronRight, ImageIcon, Pencil, Play } from "lucide-react";

import type {
  KnowledgeBaseRow,
  ProductRow,
  SopMedia,
  SopVariableRow,
} from "@/lib/sops/types";
import { tokensIn } from "@/lib/sops/variables";
import { parseSop, platformSupportsStructure } from "@/lib/sops/structure";
import { TagChips, type TagTone } from "./tag-controls";
import { SopStructuredView } from "./sop-structured-view";
import { Text, VariablesProvider } from "./sop-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Empty = the SOP applies to ALL of that dimension, shown explicitly so it isn't read as
// "untagged / missing".
function TagRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: TagTone;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {items.length > 0 ? (
        <TagChips items={items} tone={tone} />
      ) : (
        <span className="text-[12px] italic text-muted-foreground/70">All</span>
      )}
    </div>
  );
}

export const SopView = memo(function SopView({
  sop,
  platformName,
  platformCode,
  categoryName,
  products,
  variables,
  onOpenVariables,
  onEdit,
}: {
  sop: KnowledgeBaseRow;
  platformName: string;
  platformCode: string | null;
  categoryName: string;
  products: ProductRow[];
  variables: SopVariableRow[];
  onOpenVariables?: () => void;
  onEdit?: () => void;
}) {
  const created = formatDate(sop.created_at);
  // Only the Anda corpus is written to the house standard. Anything that doesn't parse into
  // blocks (a half-migrated row, a stub) falls back to the plain-text rendering.
  const doc = useMemo(
    () => (platformSupportsStructure(platformCode) ? parseSop(sop.content) : null),
    [platformCode, sop.content],
  );
  // The body above shows resolved values. This says which of those numbers are managed centrally,
  // and where to change them.
  const variableValues = useMemo(
    () => new Map(variables.map((v) => [v.name, v.value])),
    [variables],
  );

  const used = useMemo(() => {
    const byName = new Map(variables.map((v) => [v.name, v]));
    return tokensIn(sop.content).map((name) => ({
      name,
      value: byName.get(name)?.value ?? null,
    }));
  }, [sop.content, variables]);

  const productNames = sop.product_tags.map(
    (id) => products.find((p) => p.id === id)?.name ?? `#${id}`,
  );

  const [media, setMedia] = useState<SopMedia[] | null>(null);
  const [expanded, setExpanded] = useState<SopMedia | null>(null);

  // Signed media URLs are short-lived, so fetch them fresh each time a SOP is opened.
  useEffect(() => {
    let active = true;
    setMedia(null);
    setExpanded(null);
    fetch(`/api/media?sop=${sop.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) setMedia(data.media ?? []);
      })
      .catch(() => {
        if (active) setMedia([]);
      });
    return () => {
      active = false;
    };
  }, [sop.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b px-12 py-3 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span>{categoryName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="min-w-0 truncate font-medium text-foreground">
          {sop.title ?? "Untitled"}
        </span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-foreground transition-colors hover:bg-accent"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="max-w-4xl px-12 py-12">
          <header className="mb-8">
            <h1 className="font-serif text-[2rem] leading-tight font-semibold tracking-tight text-balance">
              {sop.title ?? "Untitled"}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-mono select-all" title="SOP id">
                ID {sop.id}
              </span>
              {created && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{created}</span>
                </>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <TagRow label="Products" items={productNames} tone="product" />
              <TagRow label="Vehicle" items={sop.vehicle_tags} tone="vehicle" />
              <TagRow label="Status" items={sop.driver_status_tags} tone="status" />
            </div>
          </header>

          <VariablesProvider values={variableValues}>
            {doc && doc.blocks.length > 0 ? (
              <SopStructuredView doc={doc} />
            ) : (
              <div className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap break-words text-foreground/90">
                {sop.content ? <Text value={sop.content} /> : "No content."}
              </div>
            )}
          </VariablesProvider>

          {used.length > 0 && (
            <section className="mt-12 border-t pt-8">
              <h2 className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Braces className="size-3.5" />
                Variables
                <span className="tabular-nums">({used.length})</span>
              </h2>
              <ul className="space-y-1.5">
                {used.map((v) => (
                  <li key={v.name} className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                    <code className="font-mono text-muted-foreground">{`{{${v.name}}}`}</code>
                    {v.value == null ? (
                      <span className="text-destructive">not defined on this platform</span>
                    ) : (
                      <span>{v.value}</span>
                    )}
                  </li>
                ))}
              </ul>
              {onOpenVariables && (
                <button
                  type="button"
                  onClick={onOpenVariables}
                  className="mt-3 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Change a value
                </button>
              )}
            </section>
          )}

          {/* Only render once media has actually arrived — no skeleton, so SOPs without
              any media don't flash a placeholder that reads as a failed load. */}
          {media && media.length > 0 && (
            <section className="mt-12 border-t pt-8">
              <h2 className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="size-3.5" />
                Media
                <span className="tabular-nums">({media.length})</span>
              </h2>

              {/* Horizontal thumbnail strip; each tile expands into a lightbox on click. */}
              <div className="flex gap-4 overflow-x-auto pb-3">
                {media.map((m) => (
                    <figure key={m.id} className="flex w-44 shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(m)}
                        title="Click to expand"
                        className="group relative block h-40 w-44 overflow-hidden rounded-lg border bg-muted ring-offset-background transition hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {m.mediaType === "video" ? (
                          <>
                            <video
                              src={m.url}
                              preload="metadata"
                              muted
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 grid place-items-center bg-black/30">
                              <Play className="size-7 text-white drop-shadow" fill="currentColor" />
                            </span>
                          </>
                        ) : (
                          // Signed Supabase URLs rotate per request — a plain <img> avoids
                          // Next's remote-image config and its on-the-fly optimization cache.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.url}
                            alt={m.description ?? sop.title ?? "SOP media"}
                            loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                          />
                        )}
                      </button>
                      {m.description && (
                        <figcaption className="line-clamp-3 text-[12px] leading-snug text-muted-foreground">
                          {m.description}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
            </section>
          )}
        </article>
      </div>

      {/* Lightbox — full-size media + its description */}
      <Dialog open={expanded != null} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-w-[min(80rem,calc(100%-2rem))] gap-3 sm:max-w-[min(80rem,calc(100%-2rem))]">
          <DialogTitle className="sr-only">{sop.title ?? "SOP media"}</DialogTitle>
          {expanded &&
            (expanded.mediaType === "video" ? (
              <video
                controls
                autoPlay
                src={expanded.url}
                className="mx-auto max-h-[85vh] w-auto max-w-full rounded-lg bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={expanded.url}
                alt={expanded.description ?? sop.title ?? "SOP media"}
                className="mx-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
              />
            ))}
          {expanded?.description ? (
            <DialogDescription className="text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {expanded.description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">SOP media</DialogDescription>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
