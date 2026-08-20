"use client";

import { memo } from "react";

import type { SopBlock, SopDoc } from "@/lib/sops/structure";
import { SopBody } from "./sop-body";
import { Text } from "./sop-text";

// Read view for SOPs written to the house standard: the same text, laid out by block. No
// controls, no fields — editing lives in the editor (see sop-structured-editor.tsx).

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-sans text-[0.95rem] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DriverSays({ phrases }: { phrases: string[] }) {
  return (
    <ul className="space-y-2">
      {phrases.map((p, i) => (
        <li key={i} className="border-l-2 border-border pl-3.5 leading-[1.7]">
          <Text value={p} />
        </li>
      ))}
    </ul>
  );
}

function AskFirst({ questions }: { questions: string[] }) {
  return (
    <ol className="space-y-2.5">
      {questions.map((q, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="w-5 shrink-0 pt-px text-right font-sans text-[0.8em] font-semibold tabular-nums text-muted-foreground">
            {i + 1}.
          </span>
          <div className="min-w-0 flex-1">
            <SopBody text={q} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Resolution({
  block,
}: {
  block: Extract<SopBlock, { kind: "resolution" }>;
}) {
  return (
    <div className="space-y-4">
      {block.intro.trim() && <SopBody text={block.intro} />}

      {block.branches.map((br) => (
        <div key={br.key} className="rounded-lg border bg-muted/30 px-4 py-3.5">
          <div className="mb-2.5 flex items-baseline gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded bg-foreground font-sans text-[11px] font-bold text-background">
              {br.label}
            </span>
            <p className="min-w-0 flex-1 font-medium leading-snug">
              <Text value={br.condition} />
            </p>
          </div>
          {br.body.trim() && (
            <div className="pl-[1.9rem]">
              <SopBody text={br.body} />
            </div>
          )}
        </div>
      ))}

      {block.outro.trim() && <SopBody text={block.outro} />}
    </div>
  );
}

function Block({ block }: { block: SopBlock }) {
  switch (block.kind) {
    case "phrases":
      return (
        <Section title={block.name}>
          <DriverSays phrases={block.phrases} />
        </Section>
      );
    case "questions":
      return (
        <Section title={block.name}>
          <AskFirst questions={block.questions} />
        </Section>
      );
    case "resolution":
      return (
        <Section title={block.name}>
          <Resolution block={block} />
        </Section>
      );
    default:
      return (
        <Section title={block.name}>
          <SopBody text={block.text} />
        </Section>
      );
  }
}

export const SopStructuredView = memo(function SopStructuredView({ doc }: { doc: SopDoc }) {
  return (
    <div className="space-y-8 font-serif text-[1.05rem] text-foreground/90">
      {doc.preamble.trim() && (
        <p className="leading-[1.7] whitespace-pre-wrap"><Text value={doc.preamble} /></p>
      )}
      {doc.blocks.map((b) => (
        <Block key={b.name} block={b} />
      ))}
    </div>
  );
});
