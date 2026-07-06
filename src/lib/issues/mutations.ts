import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type {
  IssueRow,
  IssueType,
  MainCategory,
  VehicleType,
} from "./types";

// Writes to dashboard.issues_list. Service-role only (this schema is not exposed to `anon`).

// Every editable column. null clears a value; undefined leaves it untouched (PATCH semantics).
export interface IssueFields {
  main_category: MainCategory | null;
  sub_category: string | null;
  sub_sub_category: string | null;
  severity: string | null;
  name: string | null;
  definition: string | null;
  chatwoot_canned_id: number | null;
  issue_type: IssueType | null;
  questions_before_log: string | null;
  questions_after_log: string | null;
  prelog_mandatory_info: string | null;
  prelog_optional_instructions: string | null;
  postlog_instructions: string | null;
  sop_ids_to_exhaust: number[];
  always_log: boolean;
  vehicle_type: VehicleType | null;
  expiration_days: number | null;
  product_tags: number[];
  vehicle_tags: string[];
  driver_status_tags: string[];
}

export type NewIssue = IssueFields & { platform_id: number };
export type IssuePatch = Partial<IssueFields>;

export async function createIssue(fields: NewIssue): Promise<IssueRow> {
  const db = getServerClient();
  const { data, error } = await db
    .schema("dashboard")
    .from("issues_list")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateIssue(id: number, patch: IssuePatch): Promise<IssueRow> {
  const db = getServerClient();
  const { data, error } = await db
    .schema("dashboard")
    .from("issues_list")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIssue(id: number): Promise<void> {
  const db = getServerClient();
  const { error } = await db
    .schema("dashboard")
    .from("issues_list")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
