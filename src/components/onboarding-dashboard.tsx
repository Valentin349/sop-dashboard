"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, Plus, RefreshCw, Search, X } from "lucide-react";

import type { Role } from "@/lib/auth/session";
import type { McqRow, OnboardingRow, TopicIndexRow } from "@/lib/onboarding/types";
import type { PlatformRow, ProductRow } from "@/lib/sops/types";
import { NO_PRODUCT, onboardingHref, productKey } from "@/lib/onboarding/nav";
import { cn } from "@/lib/utils";
import { PlatformSwitcher } from "./platform-switcher";
import { ProductColumn, TopicList, type Curriculum } from "./onboarding-list";
import { OnboardingView } from "./onboarding-view";
import { OnboardingEditor } from "./onboarding-editor";
import { CategoryNavSkeleton, OnboardingTopicSkeleton } from "./skeletons";

const EMPTY_PRODUCTS: ProductRow[] = [];
const EMPTY_MCQS: McqRow[] = [];

// Onboarding topics are read per platform and grouped product → ordered steps. Unlike SOPs there
// is no version history behind this table, so a save is final — the editor says as much.
//
// Loading is two-stage, like the SOP tab: the page seeds the nav-only index (~2 KB) so the
// columns paint on first render, and the bodies + MCQs arrive from a background fetch. Anything
// that needs a body (the view, the editor) shows a skeleton until that lands.
export function OnboardingDashboard({
  platforms,
  initialPlatformId,
  initialProductKey,
  initialTopicId,
  initialIndex,
  initialProducts,
  role,
}: {
  platforms: PlatformRow[];
  initialPlatformId: number | null;
  initialProductKey: string | null;
  initialTopicId: number | null;
  initialIndex: TopicIndexRow[];
  initialProducts: ProductRow[];
  role: Role;
}) {
  const isAdmin = role === "admin";

  const [platformId, setPlatformId] = useState(initialPlatformId);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [product, setProduct] = useState<string | null>(() => {
    const seed = initialIndex.find((t) => t.id === initialTopicId);
    return seed ? productKey(seed.product_id) : initialProductKey;
  });
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  // Per-platform caches. `index` drives the columns; `full` (the bodies) and `mcqs` follow.
  const [indexCache, setIndexCache] = useState<Record<number, TopicIndexRow[]>>(
    initialPlatformId != null ? { [initialPlatformId]: initialIndex } : {},
  );
  const [fullCache, setFullCache] = useState<Record<number, OnboardingRow[]>>({});
  const [productCache, setProductCache] = useState<Record<number, ProductRow[]>>(
    initialPlatformId != null ? { [initialPlatformId]: initialProducts } : {},
  );
  const [mcqCache, setMcqCache] = useState<Record<number, McqRow[]>>({});
  const [loading, setLoading] = useState(false);

  // Which platforms each cache already holds. A ref (not state): read and written only inside
  // fetch callbacks, never during render, and it must not trigger one.
  const loaded = useRef({
    full: new Set<number>(),
    mcqs: new Set<number>(),
    products: new Set<number>(initialPlatformId != null ? [initialPlatformId] : []),
  });
  const curPlatform = useRef(platformId);

  const syncUrl = useCallback((p: number | null, prod: string | null, t: number | null) => {
    window.history.replaceState(
      null,
      "",
      onboardingHref({ platform: p, product: prod, topic: t }),
    );
  }, []);

  // The bodies. Also refreshes the index, so a save/delete elsewhere shows up in the columns.
  const fetchTopics = useCallback(async (pid: number, force = false) => {
    if (!force && loaded.current.full.has(pid)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/onboarding?platform=${pid}`, { cache: "no-store" });
      const data = await res.json();
      const topics: OnboardingRow[] = data.topics ?? [];
      setFullCache((c) => ({ ...c, [pid]: topics }));
      setIndexCache((c) => ({ ...c, [pid]: topics }));
      loaded.current.full.add(pid);
    } finally {
      if (curPlatform.current === pid) setLoading(false);
    }
  }, []);

  // Product names label the curriculum column, so they follow a platform switch immediately.
  const fetchProducts = useCallback(async (pid: number) => {
    if (loaded.current.products.has(pid)) return;
    loaded.current.products.add(pid);
    const res = await fetch(`/api/products?platform=${pid}`, { cache: "no-store" });
    const data = await res.json();
    setProductCache((c) => ({ ...c, [pid]: data.products ?? [] }));
  }, []);

  // The MCQs are only needed once a topic is open, so they're not in the server seed either.
  const fetchMcqs = useCallback(async (pid: number) => {
    if (loaded.current.mcqs.has(pid)) return;
    loaded.current.mcqs.add(pid);
    const res = await fetch(`/api/mcq?platform=${pid}`, { cache: "no-store" });
    const data = await res.json();
    setMcqCache((c) => ({ ...c, [pid]: data.mcqs ?? [] }));
  }, []);

  // Fill in what the server deliberately left out, after first paint.
  useEffect(() => {
    if (initialPlatformId == null) return;
    void fetchTopics(initialPlatformId);
    void fetchMcqs(initialPlatformId);
  }, [initialPlatformId, fetchTopics, fetchMcqs]);

  const selectPlatform = useCallback(
    (pid: number) => {
      curPlatform.current = pid;
      setPlatformId(pid);
      setProduct(null);
      setTopicId(null);
      setEditing(false);
      setCreating(false);
      setQuery("");
      syncUrl(pid, null, null);
      void fetchTopics(pid);
      void fetchProducts(pid);
      void fetchMcqs(pid);
    },
    [syncUrl, fetchTopics, fetchProducts, fetchMcqs],
  );

  const selectProduct = useCallback(
    (key: string) => {
      setProduct(key);
      setTopicId(null);
      setEditing(false);
      setCreating(false);
      setQuery("");
      syncUrl(platformId, key, null);
    },
    [platformId, syncUrl],
  );

  const selectTopic = useCallback(
    (topic: TopicIndexRow) => {
      const key = productKey(topic.product_id);
      setTopicId(topic.id);
      setProduct(key);
      setEditing(false);
      setCreating(false);
      syncUrl(platformId, key, topic.id);
    },
    [platformId, syncUrl],
  );

  const refresh = useCallback(() => {
    if (curPlatform.current != null) void fetchTopics(curPlatform.current, true);
  }, [fetchTopics]);

  const startEdit = useCallback(() => setEditing(true), []);
  const startCreate = useCallback(() => {
    setCreating(true);
    setEditing(false);
  }, []);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setCreating(false);
  }, []);

  const onTopicSaved = useCallback(
    (saved: OnboardingRow) => {
      const key = productKey(saved.product_id == null ? null : Number(saved.product_id));
      setCreating(false);
      setEditing(false);
      setTopicId(Number(saved.id));
      setProduct(key);
      setQuery("");
      syncUrl(curPlatform.current, key, Number(saved.id));
      if (curPlatform.current != null) void fetchTopics(curPlatform.current, true);
    },
    [syncUrl, fetchTopics],
  );

  const onTopicDeleted = useCallback(() => {
    setEditing(false);
    setTopicId(null);
    syncUrl(curPlatform.current, product, null);
    if (curPlatform.current != null) void fetchTopics(curPlatform.current, true);
  }, [syncUrl, fetchTopics, product]);

  // Nav rows: the index while the bodies are in flight, the full rows once they land (they are a
  // superset, so the list gets previews and the search gets bodies without any other change).
  const rows = platformId != null ? indexCache[platformId] : undefined;
  const fullRows = platformId != null ? fullCache[platformId] : undefined;
  // Memoised: the `?? []` fallback would otherwise be a new array each render, invalidating the
  // curricula memo below on every keystroke.
  const products = useMemo(
    () => (platformId != null ? productCache[platformId] : undefined) ?? EMPTY_PRODUCTS,
    [platformId, productCache],
  );
  const mcqs = (platformId != null ? mcqCache[platformId] : undefined) ?? EMPTY_MCQS;

  // Group the corpus into curricula, in product-name order with the platform-wide bucket first.
  const curricula = useMemo<Curriculum[]>(() => {
    const byKey = new Map<string, TopicIndexRow[]>();
    for (const t of rows ?? []) {
      const key = productKey(t.product_id);
      const list = byKey.get(key);
      if (list) list.push(t);
      else byKey.set(key, [t]);
    }
    const label = (key: string) =>
      key === NO_PRODUCT
        ? "All products"
        : (products.find((p) => String(p.id) === key)?.name ?? `Product #${key}`);
    return [...byKey.entries()]
      .map(([key, list]) => ({
        key,
        label: label(key),
        topics: [...list].sort(
          (a, b) => (a.order_index ?? 1e9) - (b.order_index ?? 1e9) || a.id - b.id,
        ),
      }))
      .sort((a, b) =>
        a.key === NO_PRODUCT ? -1 : b.key === NO_PRODUCT ? 1 : a.label.localeCompare(b.label),
      );
  }, [rows, products]);

  const productLabels = useMemo(
    () => new Map(curricula.map((c) => [c.key, c.label])),
    [curricula],
  );

  const searching = query.trim().length > 0;

  // Search spans the whole platform (every curriculum); otherwise the list is one product's steps.
  // Bodies are only searchable once they've loaded — until then it matches titles and ids.
  const displayed = useMemo(() => {
    if (!searching) return curricula.find((c) => c.key === product)?.topics ?? [];
    const q = query.trim().toLowerCase();
    const corpus: TopicIndexRow[] = fullRows ?? rows ?? [];
    return corpus.filter((t) => {
      if (String(t.id).includes(q) || (t.title ?? "").toLowerCase().includes(q)) return true;
      const full = fullRows?.find((f) => f.id === t.id);
      if (!full) return false;
      return (
        (full.additional_context ?? "").toLowerCase().includes(q) ||
        full.content.some((c) => c.toLowerCase().includes(q)) ||
        full.final_checks.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [searching, query, rows, fullRows, curricula, product]);

  // The view and the editor need a body; the index row only tells us the topic exists.
  const selectedRow = rows?.find((t) => t.id === topicId) ?? null;
  const selectedTopic = fullRows?.find((t) => t.id === topicId) ?? null;
  const selectedMcq =
    selectedTopic?.mcq_id != null
      ? (mcqs.find((m) => m.id === selectedTopic.mcq_id) ?? null)
      : null;
  const platformName = platforms.find((p) => p.id === platformId)?.name ?? "Platform";

  // A new topic lands in the curriculum on screen, one step past its last.
  const currentCurriculum = curricula.find((c) => c.key === product);
  const nextOrderIndex =
    (currentCurriculum?.topics.reduce((max, t) => Math.max(max, t.order_index ?? 0), 0) ?? 0) + 1;

  return (
    <div className="flex h-full overflow-hidden text-foreground">
      {/* Column 1 — platform, actions, products */}
      <div className="flex h-full w-[260px] shrink-0 flex-col border-r bg-sidebar">
        <div className="space-y-2 p-3">
          <PlatformSwitcher
            platforms={platforms}
            currentId={platformId}
            onSelect={selectPlatform}
          />
          <div className="flex items-center gap-1.5">
            {isAdmin && platformId != null && (
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="size-3.5" />
                New topic
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
        <div className="px-3 pb-1.5 pt-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Curricula
          </p>
        </div>
        {rows === undefined ? (
          <div className="px-2">
            <CategoryNavSkeleton />
          </div>
        ) : (
          <ProductColumn curricula={curricula} selectedKey={product} onSelect={selectProduct} />
        )}
      </div>

      {/* Column 2 — the selected curriculum's steps, or platform-wide search results */}
      <div className="flex h-full w-[320px] shrink-0 flex-col border-r bg-background">
        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics on this platform"
              className="w-full rounded-md border bg-background py-1.5 pl-8 pr-8 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-baseline justify-between px-3 pb-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {searching ? "Search results" : (currentCurriculum?.label ?? "Steps")}
          </p>
          {searching && (
            <span className="text-[11px] text-muted-foreground">{displayed.length}</span>
          )}
        </div>
        {!searching && product == null ? (
          <p className="px-5 py-3 text-sm text-muted-foreground">
            {rows === undefined ? "Loading…" : "Pick a curriculum."}
          </p>
        ) : (
          <TopicList
            topics={displayed}
            selectedId={topicId}
            onSelect={selectTopic}
            showProduct={searching}
            productLabels={productLabels}
          />
        )}
      </div>

      {/* Right — the topic view / editor */}
      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="min-h-0 flex-1">
          {creating && platformId != null ? (
            <OnboardingEditor
              mode="create"
              topic={null}
              platformId={platformId}
              defaultProductKey={product ?? NO_PRODUCT}
              defaultOrderIndex={nextOrderIndex}
              products={products}
              mcqs={mcqs}
              onCancel={cancelEdit}
              onSaved={onTopicSaved}
              onDeleted={onTopicDeleted}
            />
          ) : editing && selectedTopic && platformId != null ? (
            <OnboardingEditor
              mode="edit"
              topic={selectedTopic}
              platformId={platformId}
              defaultProductKey={product ?? NO_PRODUCT}
              defaultOrderIndex={nextOrderIndex}
              products={products}
              mcqs={mcqs}
              onCancel={cancelEdit}
              onSaved={onTopicSaved}
              onDeleted={onTopicDeleted}
            />
          ) : selectedTopic ? (
            <OnboardingView
              topic={selectedTopic}
              platformName={platformName}
              productName={productLabels.get(productKey(selectedTopic.product_id)) ?? "—"}
              mcq={selectedMcq}
              onEdit={isAdmin ? startEdit : undefined}
            />
          ) : selectedRow ? (
            // Picked from the index, body still in flight.
            <OnboardingTopicSkeleton />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
              <GraduationCap className="size-7 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="max-w-xs text-sm text-muted-foreground">
                Pick a curriculum and a step to read the trainer&apos;s script.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
