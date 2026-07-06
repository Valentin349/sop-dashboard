"use client";

import { memo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import type { IssueRow } from "@/lib/issues/types";
import type { ColumnEntry, FolderNode } from "@/lib/issues/tree";
import { cn } from "@/lib/utils";

// Cascading Miller columns: main → sub → sub-sub. Every column mixes drillable category folders
// (count + chevron) with issue leaves (the deepest category level is the issue itself). Opening a
// folder reveals the next column; selecting a leaf opens the issue in the detail panel.
export const IssueColumns = memo(function IssueColumns({
  root,
  path,
  selectedIssueId,
  onOpenFolder,
  onSelectIssue,
  headerSlot,
}: {
  root: ColumnEntry[];
  path: string[]; // opened folder values, outer→inner
  selectedIssueId: number | null;
  onOpenFolder: (columnIndex: number, folder: FolderNode) => void;
  onSelectIssue: (issue: IssueRow) => void;
  headerSlot: ReactNode; // platform switcher + actions, atop the first column
}) {
  // Walk the value path to materialise each visible column and its title.
  const columns: { entries: ColumnEntry[]; title: string }[] = [
    { entries: root, title: "Categories" },
  ];
  let level = root;
  for (const value of path) {
    const folder = level.find(
      (e): e is FolderNode => e.kind === "folder" && e.value === value,
    );
    if (!folder) break;
    columns.push({ entries: folder.children, title: folder.label });
    level = folder.children;
  }

  return (
    <div className="flex h-full">
      {columns.map((col, columnIndex) => (
        <Column
          key={columnIndex}
          title={col.title}
          header={columnIndex === 0 ? headerSlot : undefined}
        >
          {col.entries.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Empty.</p>
          ) : (
            col.entries.map((entry) =>
              entry.kind === "folder" ? (
                <FolderCell
                  key={`f:${entry.value}`}
                  folder={entry}
                  active={path[columnIndex] === entry.value}
                  onClick={() => onOpenFolder(columnIndex, entry)}
                />
              ) : (
                <LeafCell
                  key={`i:${entry.issue.id}`}
                  entry={entry}
                  active={selectedIssueId === entry.issue.id}
                  onClick={() => onSelectIssue(entry.issue)}
                />
              ),
            )
          )}
        </Column>
      ))}
    </div>
  );
});

function Column({
  title,
  header,
  children,
}: {
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-[210px] shrink-0 flex-col border-r",
        header ? "bg-sidebar" : "bg-background",
      )}
    >
      {header && <div className="p-3">{header}</div>}
      <div className="px-4 pb-1.5 pt-3">
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">{children}</div>
    </div>
  );
}

function FolderCell({
  folder,
  active,
  onClick,
}: {
  folder: FolderNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 border-l-2 px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
        active
          ? "border-foreground bg-accent text-foreground"
          : "border-transparent text-foreground/90 hover:bg-muted-foreground/20",
      )}
    >
      <span className="min-w-0 truncate">{folder.label}</span>
      <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
        <span className="text-[11px] tabular-nums">{folder.count}</span>
        <ChevronRight className="size-3.5" />
      </span>
    </button>
  );
}

function LeafCell({
  entry,
  active,
  onClick,
}: {
  entry: { issue: IssueRow; label: string };
  active: boolean;
  onClick: () => void;
}) {
  const { issue, label } = entry;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 border-l-2 px-3 py-2.5 text-left text-[13px] transition-colors",
        active
          ? "border-foreground bg-accent font-semibold text-foreground"
          : "border-transparent font-medium text-foreground/90 hover:bg-muted-foreground/20",
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {issue.issue_type && (
        <span className="shrink-0 text-[11px] text-muted-foreground">{issue.issue_type}</span>
      )}
    </button>
  );
}
