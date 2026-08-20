"use client";

import { type ReactNode } from "react";

import { COND_RE, buildNodes, bubblesOf, trimBlankEdges, type Node } from "@/lib/sops/body";
import { Text } from "./sop-text";

// Renders the body of a Resolution / Cause / Environment block as formatted text: numbered steps,
// sub-bullets, IF/WHEN/THEN conditions, and example replies as the message the driver receives.
// Purely presentational — the stored text is never rewritten by this file.

// One line of body text. A leading IF / WHEN / THEN / AND / OR is set apart so a condition can't
// be skimmed past (standard §4.7) — including when it opens a numbered step.
function Line({ text }: { text: string }) {
  const m = COND_RE.exec(text);
  return (
    <p className="leading-[1.7]">
      {m && (
        <span className="font-sans font-semibold text-foreground">{m[1]}</span>
      )}
      <Text value={m ? text.slice(m[1].length) : text} />
    </p>
  );
}

function Reply({ text }: { text: string }) {
  return (
    <div className="my-3">
      <p className="mb-1.5 font-sans text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Example reply
      </p>
      <div className="space-y-2">
        {bubblesOf(text).map((message, i) => (
          <p key={i} className="leading-[1.7] whitespace-pre-wrap">
            <Text value={message} whatsapp />
          </p>
        ))}
      </div>
    </div>
  );
}

function renderNodes(nodes: Node[], depth = 0): ReactNode {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const kind = nodes[i].t;

    // Consecutive steps / bullets render as one list so their markers line up.
    if (kind === "step" || kind === "bullet") {
      const run: Node[] = [];
      while (i < nodes.length && nodes[i].t === kind) run.push(nodes[i++]);
      out.push(
        <ul key={out.length} className="space-y-2">
          {run.map((n, k) => (
            <li key={k} className="flex gap-2.5">
              <span
                className={
                  kind === "step"
                    ? "w-5 shrink-0 pt-px text-right font-sans text-[0.8em] font-semibold tabular-nums text-muted-foreground"
                    : "w-5 shrink-0 pt-px text-right text-muted-foreground"
                }
              >
                {kind === "step" ? `${(n as { num: string }).num}.` : "·"}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Line text={(n as { text: string }).text} />
                {n.kids.length > 0 && renderNodes(n.kids, depth + 1)}
              </div>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const node = nodes[i++];
    if (node.t === "reply") {
      out.push(<Reply key={out.length} text={node.text} />);
      continue;
    }
    out.push(
      <div key={out.length} className="space-y-1.5">
        <Line text={node.text} />
        {node.kids.length > 0 && renderNodes(node.kids, depth + 1)}
      </div>,
    );
  }
  return <div className="space-y-2.5">{out}</div>;
}

export function SopBody({ text }: { text: string }) {
  const lines = trimBlankEdges(text.replace(/\r\n?/g, "\n").split("\n"));
  if (lines.length === 0) return null;
  return renderNodes(buildNodes(lines));
}
