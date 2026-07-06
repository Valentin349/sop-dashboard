import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type { IssueRow, SopRef } from "./types";

// Reads from dashboard.issues_list (a different schema than SOPs). No caching: a platform change
// refetches fresh so the tab always mirrors the DB (issues are also written by the AI pipeline).

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

// Every issue on a platform — the single corpus the dashboard caches. The 3-level tree and the
// search both derive from this client-side, so it includes all fields. The corpus is small
// (≤~75 rows/platform), so there's no need to trim columns.
export function listIssuesByPlatform(platformId: number): Promise<IssueRow[]> {
  const db = getServerClient();
  return fetchAll<IssueRow>((from, to) =>
    db
      .schema("dashboard")
      .from("issues_list")
      .select("*")
      .eq("platform_id", platformId)
      .order("main_category", { nullsFirst: false })
      .order("sub_category", { nullsFirst: false })
      .order("sub_sub_category", { nullsFirst: false })
      .order("id")
      .range(from, to),
  );
}

export async function getIssue(id: number | string): Promise<IssueRow | null> {
  const db = getServerClient();
  const { data, error } = await db
    .schema("dashboard")
    .from("issues_list")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Resolve sop_ids_to_exhaust → { id, title, platform_id } from ai_agent.knowledge_base (the
// server client's default schema) so the detail view can render deep-links into the SOP tab.
export async function listSopRefsByIds(ids: number[]): Promise<SopRef[]> {
  if (ids.length === 0) return [];
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base")
    .select("id,title,platform_id")
    .in("id", ids);
  if (error) throw error;
  // Preserve the caller's order (sop_ids_to_exhaust is meaningful as an ordered list).
  const byId = new Map((data ?? []).map((r) => [Number(r.id), r as SopRef]));
  return ids.flatMap((id) => {
    const ref = byId.get(id);
    return ref ? [ref] : [{ id, title: null, platform_id: null }];
  });
}
