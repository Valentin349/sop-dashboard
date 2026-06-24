import { memo } from "react";
import { ChevronRight } from "lucide-react";

import type { KnowledgeBaseRow } from "@/lib/sops/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const SopView = memo(function SopView({
  sop,
  platformName,
  categoryName,
}: {
  sop: KnowledgeBaseRow;
  platformName: string;
  categoryName: string;
}) {
  const created = formatDate(sop.created_at);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b px-8 py-3.5 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span>{categoryName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="font-medium text-foreground">{sop.title ?? "Untitled"}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto max-w-[68ch] px-8 py-12">
          <header className="mb-8">
            <h1 className="font-serif text-[2rem] leading-tight font-semibold tracking-tight text-balance">
              {sop.title ?? "Untitled"}
            </h1>
            {created && (
              <p className="mt-3 text-[13px] text-muted-foreground">{created}</p>
            )}
          </header>

          <div className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap break-words text-foreground/90">
            {sop.content ?? "No content."}
          </div>
        </article>
      </div>
    </div>
  );
});
