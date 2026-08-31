"use client";

import { memo } from "react";
import { ChevronRight, Pencil } from "lucide-react";

import type { McqRow, OnboardingRow } from "@/lib/onboarding/types";
import { splitMarkup } from "@/lib/onboarding/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Topic bodies write UI elements and team names as ||Rider Support Chat||. Render those runs as
// chips so a trainer can see at a glance what is a literal on-screen label.
function Marked({ line }: { line: string }) {
  return (
    <>
      {splitMarkup(line).map((run, i) =>
        run.marked ? (
          <span
            key={i}
            className="mx-px rounded border bg-muted px-1 py-px font-sans text-[0.9em] font-medium text-foreground"
          >
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

// content is the ordered teaching script (numbered); final_checks the closing questions (dots).
function ListSection({
  label,
  items,
  ordered,
}: {
  label: string;
  items: string[];
  ordered: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <ol className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-[3px] w-5 shrink-0 text-right font-mono text-[12px] text-muted-foreground">
              {ordered ? i + 1 : "•"}
            </span>
            <span className="min-w-0 font-serif text-[1.05rem] leading-[1.7] break-words text-foreground/90">
              <Marked line={item} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const CHOICE_KEYS = ["A", "B", "C"] as const;

// The linked quiz, read-only: which MCQ a topic verifies with is editable, the quiz itself isn't.
function McqCard({ mcq, mcqId }: { mcq: McqRow | null; mcqId: number }) {
  return (
    <section>
      <SectionLabel>Verification MCQ</SectionLabel>
      {!mcq ? (
        <p className="text-[13px] text-muted-foreground">
          MCQ #{mcqId} is not in this platform&apos;s set.
        </p>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono select-all">#{mcq.id}</span>
            {mcq.topic && (
              <>
                <span className="opacity-50">·</span>
                <span>{mcq.topic}</span>
              </>
            )}
            {mcq.sub_topic && (
              <>
                <span className="opacity-50">·</span>
                <span>{mcq.sub_topic}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">{mcq.question}</p>
          <ul className="mt-3 space-y-1.5">
            {CHOICE_KEYS.map((k) => {
              const text = k === "A" ? mcq.choice_A : k === "B" ? mcq.choice_B : mcq.choice_C;
              if (!text) return null;
              const correct = mcq.correctChoice === k;
              return (
                <li
                  key={k}
                  className={
                    correct
                      ? "flex gap-2 rounded-md bg-primary/10 px-2 py-1 text-[13px] font-medium text-foreground"
                      : "flex gap-2 px-2 py-1 text-[13px] text-muted-foreground"
                  }
                >
                  <span className="font-mono">{k}.</span>
                  <span className="min-w-0">{text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export const OnboardingView = memo(function OnboardingView({
  topic,
  platformName,
  productName,
  mcq,
  onEdit,
}: {
  topic: OnboardingRow;
  platformName: string;
  productName: string;
  mcq: McqRow | null;
  onEdit?: () => void;
}) {
  const created = formatDate(topic.created_at);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b px-12 py-3 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span>{productName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="min-w-0 truncate font-medium text-foreground">
          {topic.title ?? `Topic #${topic.id}`}
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
              {topic.title ?? `Topic #${topic.id}`}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-mono select-all" title="Topic id">
                ID {topic.id}
              </span>
              {topic.order_index != null && (
                <>
                  <span className="opacity-50">·</span>
                  <span>step {topic.order_index}</span>
                </>
              )}
              {topic.urgency != null && (
                <>
                  <span className="opacity-50">·</span>
                  <span>urgency {topic.urgency}</span>
                </>
              )}
              {created && (
                <>
                  <span className="opacity-50">·</span>
                  <span>{created}</span>
                </>
              )}
            </p>
          </header>

          <div className="space-y-8">
            <ListSection label="Content" items={topic.content} ordered />
            <ListSection label="Final checks" items={topic.final_checks} ordered={false} />
            {topic.additional_context?.trim() && (
              <section>
                <SectionLabel>Additional context</SectionLabel>
                <div className="font-serif text-[1.05rem] leading-[1.75] whitespace-pre-wrap break-words text-foreground/90">
                  <Marked line={topic.additional_context} />
                </div>
              </section>
            )}
            {topic.mcq_id != null && <McqCard mcq={mcq} mcqId={topic.mcq_id} />}
          </div>
        </article>
      </div>
    </div>
  );
});
