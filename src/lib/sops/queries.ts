import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type {
  CategoryRow,
  KnowledgeBaseMediaRow,
  KnowledgeBaseRow,
  PlatformRow,
  SopMedia,
} from "./types";

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

export type SopWithMediaCount = KnowledgeBaseRow & { mediaCount: number };

// SOPs in one category. Includes content so the list can show a preview line and the full
// view can render instantly client-side without re-fetching per SOP click. Each SOP is
// annotated with its attachment count (from knowledge_base_media) so the list can badge it.
export async function listSopsByCategory(
  categoryId: number,
): Promise<SopWithMediaCount[]> {
  const db = getServerClient();

  const sops = await fetchAll<KnowledgeBaseRow>((from, to) =>
    db
      .from("knowledge_base")
      .select("*")
      .eq("category_id", categoryId)
      .order("title")
      .range(from, to),
  );

  const counts = new Map<number, number>();
  const ids = sops.map((s) => s.id);
  if (ids.length > 0) {
    const mediaKeys = await fetchAll<Pick<KnowledgeBaseMediaRow, "knowledge_base_id">>(
      (from, to) =>
        db
          .from("knowledge_base_media")
          .select("knowledge_base_id")
          .in("knowledge_base_id", ids)
          .range(from, to),
    );
    for (const row of mediaKeys) {
      counts.set(
        row.knowledge_base_id,
        (counts.get(row.knowledge_base_id) ?? 0) + 1,
      );
    }
  }

  return sops.map((s) => ({ ...s, mediaCount: counts.get(s.id) ?? 0 }));
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

// Media assets attached to a SOP, ordered by `index`, each with a signed URL. The storage
// buckets are private, so the URL is minted server-side and expires; the client refetches on
// each SOP open. createSignedUrls is per-bucket, so rows are grouped by bucket first.
const MEDIA_URL_TTL_SECONDS = 60 * 60; // 1h — comfortably longer than a viewing session.

export async function listSopMedia(knowledgeBaseId: number): Promise<SopMedia[]> {
  const db = getServerClient();
  const rows = await fetchAll<KnowledgeBaseMediaRow>((from, to) =>
    db
      .from("knowledge_base_media")
      .select("*")
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("index", { nullsFirst: false })
      .range(from, to),
  );

  const byBucket = new Map<string, KnowledgeBaseMediaRow[]>();
  for (const row of rows) {
    if (!row.bucket || !row.path || !row.filename) continue;
    const group = byBucket.get(row.bucket) ?? [];
    group.push(row);
    byBucket.set(row.bucket, group);
  }

  const urlByRowId = new Map<number, string>();
  await Promise.all(
    [...byBucket].map(async ([bucket, group]) => {
      const keys = group.map((r) => `${r.path}/${r.filename}`);
      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrls(keys, MEDIA_URL_TTL_SECONDS);
      if (error) throw error;
      data?.forEach((entry, i) => {
        if (entry.signedUrl) urlByRowId.set(group[i].id, entry.signedUrl);
      });
    }),
  );

  return rows.flatMap((row) => {
    const url = urlByRowId.get(row.id);
    if (!url) return [];
    return [
      {
        id: row.id,
        url,
        mediaType: row.media_type ?? "image",
        description: row.description,
        index: row.index,
      },
    ];
  });
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
