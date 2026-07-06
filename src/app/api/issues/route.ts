import { NextResponse } from "next/server";

import { listIssuesByPlatform } from "@/lib/issues/queries";
import { createIssue } from "@/lib/issues/mutations";
import type { IssueFields, IssuePatch } from "@/lib/issues/mutations";
import {
  ISSUE_TYPES,
  MAIN_CATEGORIES,
  VEHICLE_TYPES,
  type IssueType,
  type MainCategory,
  type VehicleType,
} from "@/lib/issues/types";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// --- Body coercion (shared with the [id] PATCH route) --------------------------------------
function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function intOrNull(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}
function enumOrNull<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}
function idArray(v: unknown): number[] {
  return Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : [];
}
function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// Map a request body to an issue field set. `partial` (PATCH) only pulls keys the caller sent,
// so untouched columns keep their value; a full parse (POST) supplies every column with a default.
export function parseIssueFields(body: Record<string, unknown>, partial: true): IssuePatch;
export function parseIssueFields(body: Record<string, unknown>, partial: false): IssueFields;
export function parseIssueFields(
  body: Record<string, unknown>,
  partial: boolean,
): IssueFields | IssuePatch {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const out: IssuePatch = {};

  const textFields = [
    "sub_category",
    "sub_sub_category",
    "severity",
    "name",
    "definition",
    "questions_before_log",
    "questions_after_log",
    "prelog_mandatory_info",
    "prelog_optional_instructions",
    "postlog_instructions",
  ] as const;

  const set = <K extends keyof IssueFields>(k: K, v: IssueFields[K]) => {
    (out as Record<string, unknown>)[k] = v;
  };

  if (!partial || has("main_category"))
    set("main_category", enumOrNull<MainCategory>(body.main_category, MAIN_CATEGORIES));
  if (!partial || has("issue_type"))
    set("issue_type", enumOrNull<IssueType>(body.issue_type, ISSUE_TYPES));
  if (!partial || has("vehicle_type"))
    set("vehicle_type", enumOrNull<VehicleType>(body.vehicle_type, VEHICLE_TYPES));

  for (const k of textFields) {
    if (!partial || has(k)) set(k, str(body[k]));
  }

  if (!partial || has("chatwoot_canned_id"))
    set("chatwoot_canned_id", intOrNull(body.chatwoot_canned_id));
  if (!partial || has("expiration_days"))
    set("expiration_days", intOrNull(body.expiration_days));
  if (!partial || has("sop_ids_to_exhaust"))
    set("sop_ids_to_exhaust", idArray(body.sop_ids_to_exhaust));
  if (!partial || has("always_log")) set("always_log", body.always_log === true);
  if (!partial || has("product_tags")) set("product_tags", idArray(body.product_tags));
  if (!partial || has("vehicle_tags")) set("vehicle_tags", strArray(body.vehicle_tags));
  if (!partial || has("driver_status_tags"))
    set("driver_status_tags", strArray(body.driver_status_tags));

  return out;
}

// ?platform=<id> → every issue on the platform. The single corpus the dashboard caches; the tree
// and search both derive from it client-side.
export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const issues = await listIssuesByPlatform(platform);
  return NextResponse.json({ issues });
}

export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const platform_id = Number(body.platform_id);
  if (!Number.isInteger(platform_id)) {
    return NextResponse.json({ error: "platform_id is required" }, { status: 400 });
  }

  const fields = parseIssueFields(body, false);
  if (!fields.main_category) {
    return NextResponse.json({ error: "main_category is required" }, { status: 400 });
  }

  try {
    const issue = await createIssue({ platform_id, ...fields });
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
