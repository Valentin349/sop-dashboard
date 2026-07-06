"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Plus, RefreshCw } from "lucide-react";

import type { Role } from "@/lib/auth/session";
import type { IssueRow } from "@/lib/issues/types";
import type { PlatformRow, ProductRow } from "@/lib/sops/types";
import {
  buildIssueColumns,
  folderPathForIssue,
  type FolderNode,
} from "@/lib/issues/tree";
import { issueHref } from "@/lib/issues/nav";
import { cn } from "@/lib/utils";
import { TopBarCenter } from "./top-bar-center";
import { PlatformSwitcher } from "./platform-switcher";
import { IssueSearchBar } from "./issue-search-bar";
import { IssueColumns } from "./issue-columns";
import { IssueList } from "./issue-list";
import { IssueView } from "./issue-view";
import { IssueEditor } from "./issue-editor";
import { CategoryNavSkeleton } from "./skeletons";

type IssueCache = Record<number, IssueRow[]>;

export function IssuesDashboard({
  platforms,
  initialPlatformId,
  initialIssueId,
  initialIssues,
  role,
}: {
  platforms: PlatformRow[];
  initialPlatformId: number | null;
  initialIssueId: number | null;
  initialIssues: IssueRow[];
  role: Role;
}) {
  const isAdmin = role === "admin";

  const [platformId, setPlatformId] = useState(initialPlatformId);
  const [issueId, setIssueId] = useState(initialIssueId);
  // Opened category folders, by value (outer→inner). Seeded from the deep-linked issue, if any.
  const [path, setPath] = useState<string[]>(() => {
    const seed = initialIssues.find((i) => i.id === initialIssueId);
    return seed ? folderPathForIssue(seed) : [];
  });
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  // Platform-wide filters. typeFilter = issue_type (enum); the other three are the SOP-style tags.
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<number[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Per-platform issue corpus. The columns and search both derive from it.
  const [issueCache, setIssueCache] = useState<IssueCache>(
    initialPlatformId != null ? { [initialPlatformId]: initialIssues } : {},
  );
  const [loading, setLoading] = useState(false);
  // Product tag options per platform (for tagging, display, and filtering).
  const [productCache, setProductCache] = useState<Record<number, ProductRow[]>>({});

  const issueCacheRef = useRef(issueCache);
  issueCacheRef.current = issueCache;
  const productCacheRef = useRef(productCache);
  productCacheRef.current = productCache;
  const curPlatform = useRef(platformId);

  const syncUrl = useCallback((p: number | null, i: number | null) => {
    window.history.replaceState(null, "", issueHref({ platform: p, issue: i }));
  }, []);

  const fetchIssues = useCallback(async (pid: number, force = false) => {
    if (!force && issueCacheRef.current[pid]) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/issues?platform=${pid}`, { cache: "no-store" });
      const data = await res.json();
      setIssueCache((c) => ({ ...c, [pid]: data.issues ?? [] }));
    } finally {
      if (curPlatform.current === pid) setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async (pid: number) => {
    if (productCacheRef.current[pid]) return;
    const res = await fetch(`/api/products?platform=${pid}`, { cache: "no-store" });
    const data = await res.json();
    setProductCache((c) => ({ ...c, [pid]: data.products ?? [] }));
  }, []);

  // Load the current platform's product options once on mount (for tagging + filtering).
  useEffect(() => {
    if (initialPlatformId != null) void fetchProducts(initialPlatformId);
  }, [initialPlatformId, fetchProducts]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setTypeFilter([]);
    setProductFilter([]);
    setVehicleFilter([]);
    setStatusFilter([]);
  }, []);

  const selectPlatform = useCallback(
    (pid: number) => {
      curPlatform.current = pid;
      setPlatformId(pid);
      setPath([]);
      setIssueId(null);
      setEditing(false);
      setCreating(false);
      clearSearch();
      syncUrl(pid, null);
      void fetchIssues(pid);
      void fetchProducts(pid);
    },
    [syncUrl, fetchIssues, fetchProducts, clearSearch],
  );

  const openFolder = useCallback(
    (columnIndex: number, folder: FolderNode) => {
      setPath((prev) => [...prev.slice(0, columnIndex), folder.value]);
      setIssueId(null);
      setEditing(false);
      setCreating(false);
      clearSearch();
      syncUrl(platformId, null);
    },
    [platformId, syncUrl, clearSearch],
  );

  const selectIssue = useCallback(
    (issue: IssueRow) => {
      setIssueId(issue.id);
      setEditing(false);
      setCreating(false);
      // Reflect where the issue lives so the columns line up once any search is cleared.
      setPath(folderPathForIssue(issue));
      syncUrl(platformId, issue.id);
    },
    [platformId, syncUrl],
  );

  const refresh = useCallback(() => {
    if (curPlatform.current != null) void fetchIssues(curPlatform.current, true);
  }, [fetchIssues]);

  const startEdit = useCallback(() => setEditing(true), []);
  const startCreate = useCallback(() => {
    setCreating(true);
    setEditing(false);
  }, []);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setCreating(false);
  }, []);

  const onIssueSaved = useCallback(
    (saved: IssueRow) => {
      setCreating(false);
      setEditing(false);
      setIssueId(saved.id);
      setPath(folderPathForIssue(saved));
      clearSearch();
      syncUrl(curPlatform.current, saved.id);
      if (curPlatform.current != null) void fetchIssues(curPlatform.current, true);
    },
    [syncUrl, fetchIssues, clearSearch],
  );

  const onIssueDeleted = useCallback(() => {
    setEditing(false);
    setIssueId(null);
    syncUrl(curPlatform.current, null);
    if (curPlatform.current != null) void fetchIssues(curPlatform.current, true);
  }, [syncUrl, fetchIssues]);

  const issues = platformId != null ? issueCache[platformId] : undefined;
  const root = useMemo(() => buildIssueColumns(issues ?? []), [issues]);
  const selectedIssue = issues?.find((i) => i.id === issueId) ?? null;
  const products = (platformId != null ? productCache[platformId] : undefined) ?? [];

  const activeFilterCount =
    typeFilter.length + productFilter.length + vehicleFilter.length + statusFilter.length;
  const platformMode = query.trim().length > 0 || activeFilterCount > 0;

  const displayedIssues = useMemo(() => {
    const corpus = issues ?? [];
    if (!platformMode) return [];
    const raw = query.trim();
    const idMode = raw.startsWith("#");
    const q = (idMode ? raw.slice(1) : raw).trim().toLowerCase();
    // Tag match: no selection, or the issue is untagged (applies to all), or they intersect.
    const matchesTag = (
      selected: Array<string | number>,
      tags: Array<string | number>,
    ) => selected.length === 0 || tags.length === 0 || tags.some((t) => selected.includes(t));

    return corpus.filter((i) => {
      if (q) {
        const hit = idMode
          ? String(i.id).includes(q)
          : String(i.id).includes(q) ||
            (i.name ?? "").toLowerCase().includes(q) ||
            (i.definition ?? "").toLowerCase().includes(q) ||
            (i.sub_category ?? "").toLowerCase().includes(q) ||
            (i.sub_sub_category ?? "").toLowerCase().includes(q) ||
            (i.main_category ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (typeFilter.length && !(i.issue_type && typeFilter.includes(i.issue_type)))
        return false;
      return (
        matchesTag(productFilter, i.product_tags) &&
        matchesTag(vehicleFilter, i.vehicle_tags) &&
        matchesTag(statusFilter, i.driver_status_tags)
      );
    });
  }, [issues, platformMode, query, typeFilter, productFilter, vehicleFilter, statusFilter]);

  const platformName = platforms.find((p) => p.id === platformId)?.name ?? "Platform";

  // Platform switcher + admin/refresh actions, shown atop the first left column in both modes.
  const leftHeader = (
    <div className="space-y-2">
      <PlatformSwitcher platforms={platforms} currentId={platformId} onSelect={selectPlatform} />
      <div className="flex items-center gap-1.5">
        {isAdmin && platformId != null && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" />
            New issue
          </button>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          title="Refresh from database"
          aria-label="Refresh from database"
          className="grid size-8 shrink-0 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden text-foreground">
      <TopBarCenter>
        <IssueSearchBar
          query={query}
          onQueryChange={setQuery}
          products={products}
          typeFilter={typeFilter}
          productFilter={productFilter}
          vehicleFilter={vehicleFilter}
          statusFilter={statusFilter}
          onTypeFilter={setTypeFilter}
          onProductFilter={setProductFilter}
          onVehicleFilter={setVehicleFilter}
          onStatusFilter={setStatusFilter}
          resultCount={displayedIssues.length}
          active={platformMode}
        />
      </TopBarCenter>

      {/* Left — cascading category columns, or a flat results list while searching */}
      {issues === undefined ? (
        <div className="flex h-full w-[210px] shrink-0 flex-col border-r bg-sidebar">
          <div className="p-3">{leftHeader}</div>
          <div className="px-2 pt-3">
            <CategoryNavSkeleton />
          </div>
        </div>
      ) : platformMode ? (
        <div className="flex h-full w-[300px] shrink-0 flex-col border-r bg-sidebar">
          <div className="p-3">{leftHeader}</div>
          <div className="px-3 pb-1.5 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Search results
            </p>
          </div>
          <IssueList
            issues={displayedIssues}
            selectedId={issueId}
            onSelect={selectIssue}
            showPath
          />
        </div>
      ) : (
        <IssueColumns
          root={root}
          path={path}
          selectedIssueId={issueId}
          onOpenFolder={openFolder}
          onSelectIssue={selectIssue}
          headerSlot={leftHeader}
        />
      )}

      {/* Right — the issue view / editor */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="min-h-0 flex-1">
          {creating && platformId != null ? (
            <IssueEditor
              mode="create"
              issue={null}
              platformId={platformId}
              products={products}
              onCancel={cancelEdit}
              onSaved={onIssueSaved}
              onDeleted={onIssueDeleted}
            />
          ) : editing && selectedIssue && platformId != null ? (
            <IssueEditor
              mode="edit"
              issue={selectedIssue}
              platformId={platformId}
              products={products}
              onCancel={cancelEdit}
              onSaved={onIssueSaved}
              onDeleted={onIssueDeleted}
            />
          ) : selectedIssue ? (
            <IssueView
              issue={selectedIssue}
              platformName={platformName}
              products={products}
              onEdit={isAdmin ? startEdit : undefined}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <ClipboardList className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="max-w-xs text-sm text-muted-foreground">
                Drill into a category and pick an issue to view it.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
