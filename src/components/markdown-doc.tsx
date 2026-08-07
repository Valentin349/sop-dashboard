import type { ReactNode } from "react";

// Minimal renderer for the constrained markdown our internal docs use:
// #/## headings, **bold**, `code`, "- " bullets, "1. " ordered lists, and
// 4-space-indented code blocks. Not a general markdown parser — if a doc
// starts using links or tables, extend this or switch to react-markdown.

function inline(text: string, key?: string | number): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <span key={key}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        return p;
      })}
    </span>
  );
}

type Block =
  | { kind: "h1" | "h2" | "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; lines: string[] };

function parse(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: line.slice(2) });
      i++;
      continue;
    }
    if (line.startsWith("    ")) {
      const code: string[] = [];
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) {
        code.push(lines[i].slice(4));
        i++;
      }
      while (code.length && code[code.length - 1].trim() === "") code.pop();
      blocks.push({ kind: "code", lines: code });
      continue;
    }
    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const marker = ordered ? /^\d+\. / : /^- /;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (marker.test(l)) {
          items.push(l.replace(marker, ""));
          i++;
        } else if (/^\s{2,}\S/.test(l) && !l.startsWith("    ")) {
          // hard-wrapped continuation of the previous item
          items[items.length - 1] += " " + l.trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({ kind: ordered ? "ol" : "ul", items });
      continue;
    }
    // paragraph: join hard-wrapped lines until a blank line or another construct
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("    ") &&
      !/^- /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }
  return blocks;
}

export function MarkdownDoc({ markdown }: { markdown: string }) {
  const blocks = parse(markdown);
  return (
    <article className="font-serif text-[1.05rem] leading-[1.75] text-foreground/90">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h1":
            return (
              <h1
                key={i}
                className="mt-12 mb-4 text-[1.7rem] leading-tight font-semibold tracking-tight first:mt-0"
              >
                {inline(b.text)}
              </h1>
            );
          case "h2":
            return (
              <h2 key={i} className="mt-8 mb-3 text-[1.25rem] font-semibold tracking-tight">
                {inline(b.text)}
              </h2>
            );
          case "code":
            return (
              <pre
                key={i}
                className="my-4 overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-[0.8rem] leading-[1.6]"
              >
                {b.lines.join("\n")}
              </pre>
            );
          case "ul":
            return (
              <ul key={i} className="my-3 list-disc space-y-1.5 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="my-3 list-decimal space-y-1.5 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i} className="my-3">
                {inline(b.text)}
              </p>
            );
        }
      })}
    </article>
  );
}
