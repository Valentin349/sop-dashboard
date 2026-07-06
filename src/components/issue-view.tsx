"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Pencil } from "lucide-react";

import type { IssueRow, SopRef } from "@/lib/issues/types";
import type { ProductRow } from "@/lib/sops/types";
import { issuePath } from "@/lib/issues/tree";
import { sopHref } from "@/lib/sops/nav";
import { TagChips, type TagTone } from "./tag-controls";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// A labelled row of coloured chips — same shape as SopView's TagRow, minus the "All" fallback
// (an empty issue field means unset, not "applies to all").
function ChipRow({ label, items, tone }: { label: string; items: string[]; tone: TagTone }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <TagChips items={items} tone={tone} />
    </div>
  );
}

export const IssueView = memo(function IssueView({
  issue,
  platformName,
  products,
  onEdit,
}: {
  issue: IssueRow;
  platformName: string;
  products: ProductRow[];
  onEdit?: () => void;
}) {
  const created = formatDate(issue.created_at);
  // The issue's identity is its deepest category level (name is not shown).
  const heading = issuePath(issue).split(" › ").pop() || `Issue #${issue.id}`;
  const productNames = issue.product_tags.map(
    (id) => products.find((p) => p.id === id)?.name ?? `#${id}`,
  );

  // Resolve sop_ids_to_exhaust → titles/platforms so each renders as a deep-link into the SOP tab.
  const [sopRefs, setSopRefs] = useState<SopRef[] | null>(null);
  useEffect(() => {
    const ids = issue.sop_ids_to_exhaust;
    if (!ids || ids.length === 0) {
      setSopRefs([]);
      return;
    }
    let active = true;
    setSopRefs(null);
    fetch(`/api/issues/sop-refs?ids=${ids.join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) setSopRefs(data.refs ?? []);
      })
      .catch(() => {
        if (active) setSopRefs([]);
      });
    return () => {
      active = false;
    };
  }, [issue.id, issue.sop_ids_to_exhaust]);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b px-12 py-3 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="min-w-0 truncate font-medium text-foreground">{issuePath(issue)}</span>
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
              {heading}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-mono select-all" title="Issue id">
                ID {issue.id}
              </span>
              {created && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{created}</span>
                </>
              )}
              <span className="opacity-50">·</span>
              <span>always_log: {issue.always_log ? "yes" : "no"}</span>
              {issue.expiration_days != null && (
                <>
                  <span className="opacity-50">·</span>
                  <span>expires {issue.expiration_days}d</span>
                </>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {/* Single-value classification (enum columns). */}
              <ChipRow
                label="Issue type"
                items={issue.issue_type ? [issue.issue_type] : []}
                tone="neutral"
              />
              <ChipRow
                label="Vehicle type"
                items={issue.vehicle_type ? [issue.vehicle_type] : []}
                tone="neutral"
              />
              {/* SOP-style multi-select tags (empty = applies to all). */}
              <ChipRow label="Products" items={productNames} tone="product" />
              <ChipRow label="Vehicle" items={issue.vehicle_tags} tone="vehicle" />
              <ChipRow label="Status" items={issue.driver_status_tags} tone="status" />
            </div>
          </header>

          <div className="space-y-8">
            <Section label="Definition" body={issue.definition} />
            <Section label="Questions before log" body={issue.questions_before_log} />
            <Section label="Questions after log" body={issue.questions_after_log} />
            <Section label="Prelog — mandatory info" body={issue.prelog_mandatory_info} />
            <Section
              label="Prelog — optional instructions"
              body={issue.prelog_optional_instructions}
            />
            <Section label="Postlog instructions" body={issue.postlog_instructions} />

            {/* SOPs to exhaust — clickable chips that deep-link into the Knowledge base tab. */}
            {issue.sop_ids_to_exhaust.length > 0 && (
              <section>
                <SectionLabel>SOPs to exhaust</SectionLabel>
                {sopRefs == null ? (
                  <p className="text-[13px] text-muted-foreground">Loading…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sopRefs.map((ref) => (
                      <Link
                        key={ref.id}
                        href={sopHref({ platform: ref.platform_id, sop: ref.id })}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[13px] transition-colors hover:bg-accent"
                        title={`Open SOP #${ref.id} in the Knowledge base`}
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">
                          #{ref.id}
                        </span>
                        <span className="min-w-0 max-w-xs truncate">
                          {ref.title ?? "(unknown SOP)"}
                        </span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </article>
      </div>
    </div>
  );
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function Section({ label, body }: { label: string; body: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap break-words text-foreground/90">
        {body}
      </div>
    </section>
  );
}
