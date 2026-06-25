"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";

import type { Role } from "@/lib/auth/session";

import type { CategoryWithCount, SopWithMediaCount } from "@/lib/sops/queries";
import type {
  CategoryRow,
  KnowledgeBaseRow,
  PlatformRow,
  ProductRow,
} from "@/lib/sops/types";
import { sopHref } from "@/lib/sops/nav";
import { cn } from "@/lib/utils";
import { TopBarCenter } from "./top-bar-center";
import { PlatformSwitcher } from "./platform-switcher";
import { CategoryNav } from "./category-nav";
import { SearchBar } from "./search-bar";
import { SopList } from "./sop-list";
import { SopView } from "./sop-view";
import { SopEditor } from "./sop-editor";
import { CategoryDialog } from "./category-dialog";
import { CategoryNavSkeleton, SopListSkeleton } from "./skeletons";

type CatCache = Record<number, CategoryWithCount[]>;
type SopCache = Record<number, SopWithMediaCount[]>;

// SOP-list column width, drag-resizable within these bounds.
const LIST_MIN_W = 260;
const LIST_MAX_W = 560;
const LIST_DEFAULT_W = 320;
const LIST_WIDTH_KEY = "sop-list-width";

export function Dashboard({
  platforms,
  initialPlatformId,
  initialCategoryId,
  initialSopId,
  initialCategories,
  initialProducts,
  role,
}: {
  platforms: PlatformRow[];
  initialPlatformId: number | null;
  initialCategoryId: number | null;
  initialSopId: number | null;
  initialCategories: CategoryWithCount[];
  initialProducts: ProductRow[];
  role: Role;
}) {
  const isAdmin = role === "admin";

  const [platformId, setPlatformId] = useState(initialPlatformId);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [sopId, setSopId] = useState(initialSopId);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  // Platform-wide search + tag filters (live in the top bar). When any is set, the SOP list
  // searches the whole platform rather than the open category.
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<number[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  // Category dialog: open + its target (null target = create, a row = edit).
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catDialogTarget, setCatDialogTarget] = useState<CategoryRow | null>(null);

  // Resizable SOP-list width (loaded from localStorage after mount to avoid SSR mismatch).
  const [listWidth, setListWidth] = useState(LIST_DEFAULT_W);
  useEffect(() => {
    const saved = Number(localStorage.getItem(LIST_WIDTH_KEY));
    if (saved >= LIST_MIN_W && saved <= LIST_MAX_W) setListWidth(saved);
  }, []);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = listWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    let latest = startW;
    const move = (ev: PointerEvent) => {
      latest = Math.min(LIST_MAX_W, Math.max(LIST_MIN_W, startW + ev.clientX - startX));
      setListWidth(latest);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(LIST_WIDTH_KEY, String(latest));
      } catch {}
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Client caches: a platform's categories / its full SOP corpus are fetched once and reused.
  // Only the refresh button (or a write) forces a refetch.
  const [catCache, setCatCache] = useState<CatCache>(
    initialPlatformId != null ? { [initialPlatformId]: initialCategories } : {},
  );
  // Platform-wide SOPs (every category), keyed by platform id — the single SOP source of
  // truth. The open category's list and the search both derive from this client-side. It's
  // large (full content), so it's fetched client-side (mount effect below), not seeded
  // server-side — that keeps first paint off the corpus's critical path.
  const [platformSopCache, setPlatformSopCache] = useState<SopCache>({});
  const [catLoading, setCatLoading] = useState(false);
  const [sopLoading, setSopLoading] = useState(false);
  // Product tag options per platform (for tagging, display, and filtering).
  const [productCache, setProductCache] = useState<Record<number, ProductRow[]>>(
    initialPlatformId != null ? { [initialPlatformId]: initialProducts } : {},
  );

  // Ref mirrors of the caches so the fetch callbacks can check "already cached?" without
  // depending on cache state — keeping their identity (and the children's props) stable.
  const catCacheRef = useRef(catCache);
  const platformSopCacheRef = useRef(platformSopCache);
  const productCacheRef = useRef(productCache);
  catCacheRef.current = catCache;
  platformSopCacheRef.current = platformSopCache;
  productCacheRef.current = productCache;

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

  const fetchPlatformSops = useCallback(async (pid: number, force = false) => {
    if (!force && platformSopCacheRef.current[pid]) return;
    setSopLoading(true);
    try {
      const res = await fetch(`/api/sops?platform=${pid}`, { cache: "no-store" });
      const data = await res.json();
      setPlatformSopCache((c) => ({ ...c, [pid]: data.sops ?? [] }));
    } finally {
      if (curPlatform.current === pid) setSopLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async (pid: number, force = false) => {
    if (!force && productCacheRef.current[pid]) return;
    const res = await fetch(`/api/products?platform=${pid}`, { cache: "no-store" });
    const data = await res.json();
    setProductCache((c) => ({ ...c, [pid]: data.products ?? [] }));
  }, []);

  // Load the SOP corpus for the platform rendered on first paint, in the background. The shell
  // (categories/products) is already painted from server-seeded props; the list shows its
  // skeleton until this resolves, then category views + search derive from it.
  useEffect(() => {
    if (initialPlatformId != null) void fetchPlatformSops(initialPlatformId);
  }, [initialPlatformId, fetchPlatformSops]);

  // Drop any active search/filter so navigating shows the chosen scope, not stale results.
  const clearSearch = useCallback(() => {
    setQuery("");
    setProductFilter([]);
    setVehicleFilter([]);
    setStatusFilter([]);
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
      clearSearch();
      syncUrl(pid, null, null);
      void fetchCategories(pid);
      void fetchPlatformSops(pid);
      void fetchProducts(pid);
    },
    [syncUrl, fetchCategories, fetchPlatformSops, fetchProducts, clearSearch],
  );

  const selectCategory = useCallback(
    (cid: number) => {
      curCategory.current = cid;
      setCategoryId(cid);
      setSopId(null);
      setEditing(false);
      setCreating(false);
      clearSearch();
      syncUrl(platformId, cid, null);
    },
    [platformId, syncUrl, clearSearch],
  );

  const selectSop = useCallback(
    (sop: KnowledgeBaseRow) => {
      setSopId(sop.id);
      setEditing(false);
      setCreating(false);
      // A search match can live outside the open category — follow it there so the list,
      // breadcrumb, and category nav all reflect where the SOP actually sits. The category's
      // list derives from the already-loaded corpus, so there's nothing to fetch.
      const targetCategory = sop.category_id ?? categoryId;
      if (sop.category_id != null && sop.category_id !== curCategory.current) {
        curCategory.current = sop.category_id;
        setCategoryId(sop.category_id);
      }
      syncUrl(platformId, targetCategory, sop.id);
    },
    [platformId, categoryId, syncUrl],
  );

  const refresh = useCallback(() => {
    if (curPlatform.current != null) {
      void fetchCategories(curPlatform.current, true);
      void fetchPlatformSops(curPlatform.current, true);
    }
  }, [fetchCategories, fetchPlatformSops]);

  // After a write, re-pull the platform's category counts and SOP corpus — the category list
  // and search both derive from the corpus, so this is the only SOP refetch needed.
  const reload = useCallback(() => {
    if (curPlatform.current != null) {
      void fetchCategories(curPlatform.current, true);
      void fetchPlatformSops(curPlatform.current, true);
    }
  }, [fetchCategories, fetchPlatformSops]);

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
        if (curPlatform.current != null) {
          void fetchCategories(curPlatform.current, true);
          void fetchPlatformSops(curPlatform.current, true);
        }
      } else {
        setEditing(false);
        reload();
      }
    },
    [creating, reload, syncUrl, fetchCategories, fetchPlatformSops],
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
        // Created: select the new (empty) category. Its list derives from the corpus (empty
        // until SOPs are added), so there's nothing to fetch.
        curCategory.current = cat.id;
        setCategoryId(cat.id);
        setSopId(null);
        setEditing(false);
        setCreating(false);
        syncUrl(curPlatform.current, cat.id, null);
      }
    },
    [catDialogTarget, syncUrl, fetchCategories],
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
  const platformSops = platformId != null ? platformSopCache[platformId] : undefined;
  // The open category's list is just the corpus filtered to that category — no separate fetch.
  const sops = useMemo(
    () =>
      categoryId == null
        ? undefined
        : (platformSops ?? []).filter((s) => s.category_id === categoryId),
    [platformSops, categoryId],
  );
  const products = (platformId != null ? productCache[platformId] : undefined) ?? [];
  // The selected SOP is resolved straight from the corpus, so a search match in any category
  // (not just the open one) still renders.
  const selectedSop = platformSops?.find((s) => s.id === sopId) ?? null;
  // category id → name, so search results outside the open category can show where they live.
  const categoryNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of categories ?? []) if (c.name) m.set(c.id, c.name);
    return m;
  }, [categories]);

  // A query or any active tag filter switches the list to platform-wide mode (search the
  // whole platform); otherwise the list just shows the open category.
  const activeFilterCount =
    productFilter.length + vehicleFilter.length + statusFilter.length;
  const platformMode = query.trim().length > 0 || activeFilterCount > 0;
  // Both modes derive from the corpus, so a single load gate covers them.
  const listLoading = platformSops === undefined;

  const displayedSops = useMemo(() => {
    // A leading "#" searches by id only (e.g. "#123"); otherwise text matches id, title, or
    // content. Rows are labelled "#<id>", so "#" is the natural way to jump to one.
    const raw = query.trim();
    const idMode = raw.startsWith("#");
    const q = (idMode ? raw.slice(1) : raw).trim().toLowerCase();
    const corpus = platformMode ? platformSops ?? [] : sops ?? [];
    // A SOP matches a tag filter if it has no tags of that type (untagged = applies to ALL),
    // or it shares at least one selected value. Within a type: OR. Across types: AND.
    const matchesTag = (
      selected: Array<string | number>,
      tags: Array<string | number>,
    ) => selected.length === 0 || tags.length === 0 || tags.some((t) => selected.includes(t));

    return corpus.filter((s) => {
      if (q) {
        const hit = idMode
          ? String(s.id).includes(q)
          : String(s.id).includes(q) ||
            (s.title ?? "").toLowerCase().includes(q) ||
            (s.content ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return (
        matchesTag(productFilter, s.product_tags) &&
        matchesTag(vehicleFilter, s.vehicle_tags) &&
        matchesTag(statusFilter, s.driver_status_tags)
      );
    });
  }, [platformMode, platformSops, sops, query, productFilter, vehicleFilter, statusFilter]);
  const platformName = platforms.find((p) => p.id === platformId)?.name ?? "Platform";
  const categoryName =
    categories?.find((c) => c.id === categoryId)?.name ?? "Category";

  return (
    <div className="flex h-full overflow-hidden text-foreground">
      {/* Search bar is portaled up into the persistent top bar. */}
      <TopBarCenter>
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          products={products}
          productFilter={productFilter}
          vehicleFilter={vehicleFilter}
          statusFilter={statusFilter}
          onProductFilter={setProductFilter}
          onVehicleFilter={setVehicleFilter}
          onStatusFilter={setStatusFilter}
          resultCount={displayedSops.length}
          active={platformMode}
        />
      </TopBarCenter>
      {/* Column 1 — platform + categories */}
      <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar">
        <div className="space-y-3 p-3">
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
            {isAdmin && platformId != null && (
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
              onEdit={isAdmin ? openEditCategory : undefined}
            />
          ) : catLoading ? (
            <CategoryNavSkeleton />
          ) : null}
        </div>
      </aside>

      {/* Column 2 — SOP list */}
      <aside
        style={{ width: listWidth }}
        className="flex shrink-0 flex-col bg-background"
      >
        {!platformMode && categoryId == null ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Choose a category, or search above to span the whole platform.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="truncate text-sm font-semibold">
                {platformMode ? "Search results" : categoryName}
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-1 text-[11px] tabular-nums text-muted-foreground">
                  {displayedSops.length}
                </span>
                {isAdmin && !platformMode && (
                  <button
                    type="button"
                    onClick={startCreate}
                    title="New SOP"
                    aria-label="New SOP"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
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
            {listLoading ? (
              <SopListSkeleton />
            ) : (
              <SopList
                sops={displayedSops}
                selectedId={sopId}
                onSelect={selectSop}
                showCategory={platformMode}
                categoryNameById={categoryNameById}
              />
            )}
          </>
        )}
      </aside>

      {/* Resizer between the SOP list and the view — drag to widen/narrow the list */}
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-ring/60 active:bg-ring"
      />

      {/* Column 3 — the SOP view / editor (search lives in the top bar) */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="min-h-0 flex-1">
        {creating && platformId != null ? (
          <SopEditor
            mode="create"
            sop={null}
            platformId={platformId}
            categoryId={categoryId}
            categories={categories ?? []}
            products={products}
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
            products={products}
            onCancel={cancelEdit}
            onSaved={onSopSaved}
            onDeleted={onSopDeleted}
          />
        ) : selectedSop ? (
          <SopView
            sop={selectedSop}
            platformName={platformName}
            categoryName={categoryName}
            products={products}
            onEdit={isAdmin ? startEdit : undefined}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
            <FileText className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
            <p className="max-w-xs text-sm text-muted-foreground">
              Select a procedure from the list to read it.
            </p>
          </div>
        )}
        </div>
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
