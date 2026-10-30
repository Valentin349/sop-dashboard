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

// Adds a value to the enum `dashboard.main_category` through the `dashboard.add_main_category`
// RPC (db/issue-main-categories.sql; security definer, service_role only). PostgREST cannot run
// DDL itself, so the function is the one path. `add value if not exists` makes it idempotent.
export async function addMainCategory(name: string): Promise<void> {
  const db = getServerClient();
  const { error } = await db.schema("dashboard").rpc("add_main_category", { p_name: name });
  if (error) {
    // PGRST202 = no such function: the SQL has not been applied to this database.
    if (error.code === "PGRST202") {
      throw new Error(
        "The database is missing dashboard.add_main_category — run db/issue-main-categories.sql in the Supabase SQL editor first.",
      );
    }
    throw new Error(error.message);
  }
}
