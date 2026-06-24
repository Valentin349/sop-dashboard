import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type { CategoryRow, KnowledgeBaseRow, PlatformRow } from "./types";

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

export function listSops(): Promise<KnowledgeBaseRow[]> {
  const db = getServerClient();
  return fetchAll<KnowledgeBaseRow>((from, to) =>
    db
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to),
  );
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

export function listCategories(): Promise<CategoryRow[]> {
  const db = getServerClient();
  return fetchAll<CategoryRow>((from, to) =>
    db.from("knowledge_base_categories").select("*").order("name").range(from, to),
  );
}

// Platforms live in the `public` schema, not `ai_agent`.
export function listPlatforms(): Promise<PlatformRow[]> {
  const db = getServerClient();
  return fetchAll<PlatformRow>((from, to) =>
    db.schema("public").from("platforms").select("*").order("id").range(from, to),
  );
}
