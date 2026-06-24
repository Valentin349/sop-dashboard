"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";

import type { CategoryWithCount, SopWithMediaCount } from "@/lib/sops/queries";
import type { CategoryRow, KnowledgeBaseRow, PlatformRow } from "@/lib/sops/types";
import { sopHref } from "@/lib/sops/nav";
import { cn } from "@/lib/utils";
import { PlatformSwitcher } from "./platform-switcher";
import { CategoryNav } from "./category-nav";
import { SopList } from "./sop-list";
import { SopView } from "./sop-view";
import { SopEditor } from "./sop-editor";
import { CategoryDialog } from "./category-dialog";
import { CategoryNavSkeleton, SopListSkeleton } from "./skeletons";

type CatCache = Record<number, CategoryWithCount[]>;
type SopCache = Record<number, SopWithMediaCount[]>;

export function Dashboard({
  platforms,
  initialPlatformId,
  initialCategoryId,
  initialSopId,
  initialCategories,
  initialSops,
}: {
  platforms: PlatformRow[];
  initialPlatformId: number | null;
  initialCategoryId: number | null;
  initialSopId: number | null;
  initialCategories: CategoryWithCount[];
  initialSops: SopWithMediaCount[];
}) {
  const [platformId, setPlatformId] = useState(initialPlatformId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [sopId, setSopId] = useState(initialSopId);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  // Category dialog: open + its target (null target = create, a row = edit).
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catDialogTarget, setCatDialogTarget] = useState<CategoryRow | null>(null);

  // Client caches: a category's SOPs / a platform's categories are fetched once and reused.
  // Only the refresh button forces a refetch.
  const [catCache, setCatCache] = useState<CatCache>(
    initialPlatformId != null ? { [initialPlatformId]: initialCategories } : {},
  );
  const [sopCache, setSopCache] = useState<SopCache>(
    initialCategoryId != null ? { [initialCategoryId]: initialSops } : {},
  );
  const [catLoading, setCatLoading] = useState(false);
  const [sopLoading, setSopLoading] = useState(false);

  // Ref mirrors of the caches so the fetch callbacks can check "already cached?" without
  // depending on cache state — keeping their identity (and the children's props) stable.
  const catCacheRef = useRef(catCache);
  const sopCacheRef = useRef(sopCache);
  catCacheRef.current = catCache;
  sopCacheRef.current = sopCache;

  // Track the latest selection so out-of-order fetch responses don't clobber loading state.
  const curPlatform = useRef(platformId);
  const curCategory = useRef(categoryId);

  const syncUrl = useCallback((p: number | null, c: number | null, s: number | null) => {
    window.history.replaceState(null, "", sopHref({ platform: p, category: c, sop: s }));
  }, []);

  // cache: "no-store" — our client state is the cache layer, so a network call must be real
  // (and the refresh button must get genuinely fresh data, not a browser-cached response).
  const fetchCategories = useCallback(async (pid: number, force = false) => {
    if (!force && catCacheRef.current[pid]) return;
    setCatLoading(true);
    try {
      const res = await fetch(`/api/categories?platform=${pid}`, { cache: "no-store" });
      const data = await res.json();
      setCatCache((c) => ({ ...c, [pid]: data.categories ?? [] }));
    } finally {
      if (curPlatform.current === pid) setCatLoading(false);
    }
  }, []);

  const fetchSops = useCallback(async (cid: number, force = false) => {
    if (!force && sopCacheRef.current[cid]) return;
    setSopLoading(true);
    try {
      const res = await fetch(`/api/sops?category=${cid}`, { cache: "no-store" });
      const data = await res.json();
      setSopCache((c) => ({ ...c, [cid]: data.sops ?? [] }));
    } finally {
      if (curCategory.current === cid) setSopLoading(false);
    }
  }, []);

  const selectPlatform = useCallback(
    (pid: number) => {
      curPlatform.current = pid;
      curCategory.current = null;
      setPlatformId(pid);
      setCategoryId(null);
      setSopId(null);
      setEditing(false);
      setCreating(false);
      syncUrl(pid, null, null);
      void fetchCategories(pid);
    },
    [syncUrl, fetchCategories],
  );

  const selectCategory = useCallback(
    (cid: number) => {
      curCategory.current = cid;
      setCategoryId(cid);
      setSopId(null);
      setEditing(false);
      setCreating(false);
      syncUrl(platformId, cid, null);
      void fetchSops(cid);
    },
    [platformId, syncUrl, fetchSops],
  );

  const selectSop = useCallback(
    (sop: KnowledgeBaseRow) => {
      setSopId(sop.id);
      setEditing(false);
      setCreating(false);
      syncUrl(platformId, categoryId, sop.id);
    },
    [platformId, categoryId, syncUrl],
  );

  const refresh = useCallback(() => {
    if (curPlatform.current != null) void fetchCategories(curPlatform.current, true);
    if (curCategory.current != null) void fetchSops(curCategory.current, true);
  }, [fetchCategories, fetchSops]);

  // After a write, re-pull the current category's SOPs + the platform's category counts.
  const reload = useCallback(() => {
    if (curPlatform.current != null) void fetchCategories(curPlatform.current, true);
    if (curCategory.current != null) void fetchSops(curCategory.current, true);
  }, [fetchCategories, fetchSops]);

  const startEdit = useCallback(() => setEditing(true), []);
  const startCreate = useCallback(() => setCreating(true), []);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setCreating(false);
    reload(); // media may have changed via the editor's immediate ops
  }, [reload]);

  const onSopSaved = useCallback(
    (saved: KnowledgeBaseRow) => {
      if (creating) {
        setCreating(false);
        if (saved.category_id != null && saved.category_id !== curCategory.current) {
          curCategory.current = saved.category_id;
          setCategoryId(saved.category_id);
        }
        setSopId(saved.id);
        syncUrl(curPlatform.current, saved.category_id ?? null, saved.id);
        if (curPlatform.current != null) void fetchCategories(curPlatform.current, true);
        if (saved.category_id != null) void fetchSops(saved.category_id, true);
      } else {
        setEditing(false);
        reload();
      }
    },
    [creating, reload, syncUrl, fetchCategories, fetchSops],
  );

  const onSopDeleted = useCallback(() => {
    setEditing(false);
    setSopId(null);
    syncUrl(curPlatform.current, curCategory.current, null);
    reload();
  }, [reload, syncUrl]);

  const openCreateCategory = useCallback(() => {
    setCatDialogTarget(null);
    setCatDialogOpen(true);
  }, []);

  const openEditCategory = useCallback((cat: CategoryRow) => {
    setCatDialogTarget(cat);
    setCatDialogOpen(true);
  }, []);

  const onCategorySaved = useCallback(
    (cat: CategoryRow) => {
      if (curPlatform.current == null) return;
      void fetchCategories(curPlatform.current, true); // pick up the new/renamed category
      if (catDialogTarget == null) {
        // Created: select the new (empty) category.
        curCategory.current = cat.id;
        setCategoryId(cat.id);
        setSopId(null);
        setEditing(false);
        setCreating(false);
        syncUrl(curPlatform.current, cat.id, null);
        void fetchSops(cat.id, true);
      }
    },
    [catDialogTarget, syncUrl, fetchCategories, fetchSops],
  );

  const onCategoryDeleted = useCallback(
    (id: number) => {
      if (curPlatform.current == null) return;
      if (curCategory.current === id) {
        curCategory.current = null;
        setCategoryId(null);
        setSopId(null);
        syncUrl(curPlatform.current, null, null);
      }
      void fetchCategories(curPlatform.current, true);
    },
    [syncUrl, fetchCategories],
  );

  const categories = platformId != null ? catCache[platformId] : undefined;
  const sops = categoryId != null ? sopCache[categoryId] : undefined;
  const selectedSop = sops?.find((s) => s.id === sopId) ?? null;
  const platformName = platforms.find((p) => p.id === platformId)?.name ?? "Platform";
  const categoryName =
    categories?.find((c) => c.id === categoryId)?.name ?? "Category";

  return (
    <div className="flex h-screen overflow-hidden text-foreground">
      {/* Column 1 — platform + categories */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
        <div className="space-y-3 p-3">
          <div className="px-1 pt-1">
            <p className="text-sm font-semibold tracking-tight">SOP Dashboard</p>
            <p className="text-[11px] text-muted-foreground">Knowledge base</p>
          </div>
          <PlatformSwitcher
            platforms={platforms}
            currentId={platformId}
            onSelect={selectPlatform}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Categories
            </p>
            {platformId != null && (
              <button
                type="button"
                onClick={openCreateCategory}
                title="New category"
                aria-label="New category"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
          {categories ? (
            <CategoryNav
              categories={categories}
              currentCategoryId={categoryId}
              onSelect={selectCategory}
              onEdit={openEditCategory}
            />
          ) : catLoading ? (
            <CategoryNavSkeleton />
          ) : null}
        </div>
      </aside>

      {/* Column 2 — SOP list */}
      <aside className="flex w-80 shrink-0 flex-col border-r bg-background">
        {categoryId == null ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Choose a category to list its SOPs.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="truncate text-sm font-semibold">{categoryName}</h2>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-1 text-[11px] tabular-nums text-muted-foreground">
                  {sops?.length ?? ""}
                </span>
                <button
                  type="button"
                  onClick={startCreate}
                  title="New SOP"
                  aria-label="New SOP"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={sopLoading || catLoading}
                  title="Refresh from database"
                  aria-label="Refresh from database"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3.5", sopLoading && "animate-spin")} />
                </button>
              </div>
            </div>
            {sops ? (
              <SopList sops={sops} selectedId={sopId} onSelect={selectSop} />
            ) : (
              <SopListSkeleton />
            )}
          </>
        )}
      </aside>

      {/* Column 3 — full SOP view / editor */}
      <section className="min-w-0 flex-1 bg-background">
        {creating && platformId != null ? (
          <SopEditor
            mode="create"
            sop={null}
            platformId={platformId}
            categoryId={categoryId}
            categories={categories ?? []}
            onCancel={cancelEdit}
            onSaved={onSopSaved}
            onDeleted={onSopDeleted}
          />
        ) : editing && selectedSop && platformId != null ? (
          <SopEditor
            mode="edit"
            sop={selectedSop}
            platformId={platformId}
            categoryId={categoryId}
            categories={categories ?? []}
            onCancel={cancelEdit}
            onSaved={onSopSaved}
            onDeleted={onSopDeleted}
          />
        ) : selectedSop ? (
          <SopView
            sop={selectedSop}
            platformName={platformName}
            categoryName={categoryName}
            onEdit={startEdit}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
            <FileText className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
            <p className="max-w-xs text-sm text-muted-foreground">
              Select a procedure from the list to read it.
            </p>
          </div>
        )}
      </section>

      {platformId != null && (
        <CategoryDialog
          open={catDialogOpen}
          onOpenChange={setCatDialogOpen}
          platformId={platformId}
          category={catDialogTarget}
          onSaved={onCategorySaved}
          onDeleted={onCategoryDeleted}
        />
      )}
    </div>
  );
}
