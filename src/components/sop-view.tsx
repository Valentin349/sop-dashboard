"use client";

import { Fragment, memo, useEffect, useState, type ReactNode } from "react";
import { ChevronRight, ImageIcon, Pencil, Play } from "lucide-react";

import type { KnowledgeBaseRow, SopMedia } from "@/lib/sops/types";
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

// Turn bare URLs in plain-text content into clickable links, leaving everything else intact.
// Trailing sentence punctuation is kept out of the href so "see https://x.com." doesn't break.
const URL_RE = /(https?:\/\/[^\s<]+)/g;

function linkify(text: string): ReactNode {
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

export const SopView = memo(function SopView({
  sop,
  platformName,
  categoryName,
  onEdit,
}: {
  sop: KnowledgeBaseRow;
  platformName: string;
  categoryName: string;
  onEdit?: () => void;
}) {
  const created = formatDate(sop.created_at);

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
          </header>

          <div className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap break-words text-foreground/90">
            {sop.content ? linkify(sop.content) : "No content."}
          </div>

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
