import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type { OnboardingRow } from "./types";

// Writes to ai_agent.onboarding_content. Service-role only (the schema is not exposed to
// `anon`). No version history here — unlike knowledge_base, this table has no snapshot trigger.

// Every editable column. null clears a value; undefined leaves it untouched (PATCH semantics).
export interface TopicFields {
  title: string | null;
  content: string[];
  final_checks: string[];
  additional_context: string | null;
  order_index: number | null;
  urgency: number | null;
  mcq_id: number | null;
  product_id: number | null;
}

export type NewTopic = TopicFields & { platform_id: number };
export type TopicPatch = Partial<TopicFields>;

export async function createTopic(fields: NewTopic): Promise<OnboardingRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("onboarding_content")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTopic(id: number, patch: TopicPatch): Promise<OnboardingRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("onboarding_content")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTopic(id: number): Promise<void> {
  const db = getServerClient();
  const { error } = await db.from("onboarding_content").delete().eq("id", id);
  if (error) throw error;
}
