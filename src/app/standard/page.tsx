import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MarkdownDoc } from "@/components/markdown-doc";

export const metadata = { title: "SOP Writing Standard" };

export default async function StandardPage() {
  const md = await readFile(
    path.join(process.cwd(), "src/content/sop-writing-standard.md"),
    "utf-8",
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <MarkdownDoc markdown={md} />
      </div>
    </div>
  );
}
