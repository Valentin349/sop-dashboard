"use client";

import { memo } from "react";

import type { IssueRow } from "@/lib/issues/types";
import { issuePath } from "@/lib/issues/tree";
import { cn } from "@/lib/utils";

function preview(text: string | null): string {
  if (!text) return "";
  return text.slice(0, 140).replace(/\s+/g, " ").trim();
}

// A row's headline is its deepest category segment (its identity).
function title(issue: IssueRow): string {
  const last = issuePath(issue).split(" › ").pop();
  return last || `Issue #${issue.id}`;
}

const IssueRowItem = memo(function IssueRowItem({
  issue,
  active,
  showPath,
  onSelect,
}: {
  issue: IssueRow;
  active: boolean;
  showPath: boolean;
  onSelect: (issue: IssueRow) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(issue)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
      className={cn(
        "block w-full border-l-2 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-foreground bg-accent"
          : "border-transparent hover:bg-muted-foreground/20",
      )}
    >
      <span
        className={cn(
          "flex items-start justify-between gap-2 text-[13px] leading-snug",
          active ? "font-semibold text-foreground" : "font-medium text-foreground/90",
        )}
      >
        <span className="min-w-0">{title(issue)}</span>
        <span className="mt-px flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {issue.vehicle_type && <span>{issue.vehicle_type}</span>}
          {issue.issue_type && <span>{issue.issue_type}</span>}
        </span>
      </span>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        <span className="font-mono text-muted-foreground/70">#{issue.id}</span>
        {showPath && (
          <>
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-muted-foreground/90">{issuePath(issue)}</span>
          </>
        )}
        {issue.definition && <span className="mx-1.5 opacity-40">·</span>}
        {preview(issue.definition)}
      </p>
    </button>
  );
});

// Presentational list of already-filtered issues. Tree/search state lives in the orchestrator.
export const IssueList = memo(function IssueList({
  issues,
  selectedId,
  onSelect,
  showPath,
}: {
  issues: IssueRow[];
  selectedId: number | null;
  onSelect: (issue: IssueRow) => void;
  // True in platform-wide (search) mode, when rows can span categories — then show the path.
  showPath: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      {issues.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">No matching issues.</p>
      ) : (
        issues.map((issue) => (
          <IssueRowItem
            key={issue.id}
            issue={issue}
            active={issue.id === selectedId}
            showPath={showPath}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
});
