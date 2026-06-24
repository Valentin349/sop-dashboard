import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type { CategoryRow, KnowledgeBaseRow, PlatformRow } from "./types";

// No caching: a category/platform change refetches fresh so the dashboard always mirrors the
// DB (SOPs are also written by the AI pipeline, which this app can't invalidate). SOP clicks
// don't hit these at all — the list's SOPs are already loaded and selection is client-side.

// Range-paginated reads, mirroring driver-context-manager/data/database_read.py.
const PAGE_SIZE = 1000;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

// Platforms live in the `public` schema, not `ai_agent`.
export function listPlatforms(): Promise<PlatformRow[]> {
  const db = getServerClient();
  return fetchAll<PlatformRow>((from, to) =>
    db.schema("public").from("platforms").select("*").order("id").range(from, to),
  );
}

export type CategoryWithCount = CategoryRow & { sopCount: number };

// Categories for one platform, each annotated with how many SOPs reference it.
// Counts come from a lightweight id/category_id scan of knowledge_base for the platform.
export async function listCategoriesByPlatform(
  platformId: number,
): Promise<CategoryWithCount[]> {
  const db = getServerClient();

  const [categories, sopKeys] = await Promise.all([
    fetchAll<CategoryRow>((from, to) =>
      db
        .from("knowledge_base_categories")
        .select("*")
        .eq("platform_id", platformId)
        .order("name")
        .range(from, to),
    ),
    fetchAll<Pick<KnowledgeBaseRow, "id" | "category_id">>((from, to) =>
      db
        .from("knowledge_base")
        .select("id,category_id")
        .eq("platform_id", platformId)
        .range(from, to),
    ),
  ]);

  const counts = new Map<number, number>();
  for (const row of sopKeys) {
    if (row.category_id == null) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return categories.map((c) => ({ ...c, sopCount: counts.get(c.id) ?? 0 }));
}

// SOPs in one category. Includes content so the list can show a preview line and the full
// view can render instantly client-side without re-fetching per SOP click.
export function listSopsByCategory(categoryId: number): Promise<KnowledgeBaseRow[]> {
  const db = getServerClient();
  return fetchAll<KnowledgeBaseRow>((from, to) =>
    db
      .from("knowledge_base")
      .select("*")
      .eq("category_id", categoryId)
      .order("title")
      .range(from, to),
  );
}

export async function getCategory(id: number | string): Promise<CategoryRow | null> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base_categories")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSop(id: number | string): Promise<KnowledgeBaseRow | null> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
