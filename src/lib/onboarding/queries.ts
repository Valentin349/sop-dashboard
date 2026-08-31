import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type { McqRow, OnboardingRow, TopicIndexRow } from "./types";

// Reads ai_agent.onboarding_content (the server client's default schema) and comms.mcq.
// No caching: a platform change refetches fresh so the tab always mirrors the DB.

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

// The array columns are nullable in the DB; coerce to [] so consumers never hit null.
function normalize(row: OnboardingRow): OnboardingRow {
  return {
    ...row,
    content: row.content ?? [],
    final_checks: row.final_checks ?? [],
    product_id: row.product_id == null ? null : Number(row.product_id),
    mcq_id: row.mcq_id == null ? null : Number(row.mcq_id),
    id: Number(row.id),
  };
}

// Every onboarding topic on a platform — the corpus the dashboard caches. The product columns
// and the topic list both derive from it client-side (≤~140 rows/platform).
export async function listTopicsByPlatform(platformId: number): Promise<OnboardingRow[]> {
  const db = getServerClient();
  const rows = await fetchAll<OnboardingRow>((from, to) =>
    db
      .from("onboarding_content")
      .select("*")
      .eq("platform_id", platformId)
      .order("product_id", { nullsFirst: true })
      .order("order_index", { nullsFirst: false })
      .order("id")
      .range(from, to),
  );
  return rows.map(normalize);
}

// The nav-only projection of the same corpus: no content, final_checks or additional_context.
// One small round trip, so the tab paints its columns without waiting on the bodies.
export async function listTopicIndexByPlatform(platformId: number): Promise<TopicIndexRow[]> {
  const db = getServerClient();
  const rows = await fetchAll<TopicIndexRow>((from, to) =>
    db
      .from("onboarding_content")
      .select("id,title,order_index,product_id,mcq_id")
      .eq("platform_id", platformId)
      .order("product_id", { nullsFirst: true })
      .order("order_index", { nullsFirst: false })
      .order("id")
      .range(from, to),
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    product_id: r.product_id == null ? null : Number(r.product_id),
    mcq_id: r.mcq_id == null ? null : Number(r.mcq_id),
  }));
}

export async function getTopic(id: number | string): Promise<OnboardingRow | null> {
  const db = getServerClient();
  const { data, error } = await db
    .from("onboarding_content")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

// The MCQs a topic on this platform may link to: the platform's own, plus the ones with no
// platform (30 of Anda's linked quizzes are platform-less). Small corpus (~170 rows total), so
// the whole set ships once and both the view and the picker read from it.
export async function listMcqsByPlatform(platformId: number): Promise<McqRow[]> {
  const db = getServerClient();
  const rows = await fetchAll<McqRow>((from, to) =>
    db
      .schema("comms")
      .from("mcq")
      .select("id,question,choice_A,choice_B,choice_C,correctChoice,topic,sub_topic,platform_id")
      .or(`platform_id.eq.${platformId},platform_id.is.null`)
      .order("topic", { nullsFirst: false })
      .order("id")
      .range(from, to),
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}
