// Pure, client-safe helpers that turn a platform's issue corpus into cascading columns
// (main_category → sub_category → sub_sub_category). There is no categories table — the
// hierarchy lives on the issue rows themselves.
//
// Key rule (per the data owner): an issue IS its deepest non-null category level. So a category
// value is a drillable *folder* only when some issue goes deeper along it; otherwise that value
// is itself an *issue* (a leaf). sub_sub is usually the issue; if an issue has no sub_sub, its
// sub is the issue; if it has no sub either, its main is the issue.

import type { IssueRow } from "./types";

// Treat null / blank the same, so "" doesn't spawn a phantom node distinct from null.
function norm(v: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export const UNCATEGORIZED = "(uncategorized)";

// A drillable category folder (has issues deeper along it).
export interface FolderNode {
  kind: "folder";
  value: string; // the category value at this level ("" for a null main bucket)
  label: string;
  count: number; // issues in the whole subtree
  children: ColumnEntry[];
}
// A leaf = an actual issue.
export interface IssueLeaf {
  kind: "issue";
  issue: IssueRow;
  label: string;
}
export type ColumnEntry = FolderNode | IssueLeaf;

// The three category columns, deepest-first, used to label an issue leaf.
function valueAt(issue: IssueRow, level: number): string | null {
  return norm(
    level === 0
      ? issue.main_category
      : level === 1
        ? issue.sub_category
        : issue.sub_sub_category,
  );
}

// An issue's display name: an explicit name, else its deepest category value, else its id.
export function issueLabel(issue: IssueRow): string {
  return (
    issue.name?.trim() ||
    valueAt(issue, 2) ||
    valueAt(issue, 1) ||
    valueAt(issue, 0) ||
    `Issue #${issue.id}`
  );
}

function leafOf(issue: IssueRow): IssueLeaf {
  return { kind: "issue", issue, label: issueLabel(issue) };
}

// Group `issues` by their value at `level` (0=main, 1=sub, 2=sub_sub), preserving input order.
// A group whose value goes deeper becomes a folder (recurse); otherwise its issues are leaves.
function buildLevel(issues: IssueRow[], level: number): ColumnEntry[] {
  const order: (string | null)[] = [];
  const groups = new Map<string | null, IssueRow[]>();
  for (const issue of issues) {
    const v = valueAt(issue, level);
    let g = groups.get(v);
    if (!g) {
      g = [];
      groups.set(v, g);
      order.push(v);
    }
    g.push(issue);
  }

  const entries: ColumnEntry[] = [];
  for (const v of order) {
    const group = groups.get(v)!;
    // Below the main level, a null value means "no such level" — the issue is a leaf here.
    if (v == null && level > 0) {
      for (const issue of group) entries.push(leafOf(issue));
      continue;
    }
    const goesDeeper = level < 2 && group.some((i) => valueAt(i, level + 1) != null);
    if (goesDeeper) {
      entries.push({
        kind: "folder",
        value: v ?? "",
        label: v ?? UNCATEGORIZED,
        count: group.length,
        children: buildLevel(group, level + 1),
      });
    } else {
      for (const issue of group) entries.push(leafOf(issue));
    }
  }
  return entries;
}

export function buildIssueColumns(issues: IssueRow[]): ColumnEntry[] {
  return buildLevel(issues, 0);
}

// The folder path (by value) that contains an issue — i.e. its non-null category levels with the
// deepest (the leaf) removed. Ancestors of a leaf are always folders, so this needs no lookup.
export function folderPathForIssue(issue: IssueRow): string[] {
  const vals = [valueAt(issue, 0), valueAt(issue, 1), valueAt(issue, 2)].filter(
    (v): v is string => v != null,
  );
  return vals.slice(0, -1);
}

// Human-readable category path for a single issue (used in the search list + detail breadcrumb).
export function issuePath(issue: IssueRow): string {
  return [valueAt(issue, 0) ?? UNCATEGORIZED, valueAt(issue, 1), valueAt(issue, 2)]
    .filter(Boolean)
    .join(" › ");
}
