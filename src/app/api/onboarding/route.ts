import { NextResponse } from "next/server";

import { listTopicsByPlatform } from "@/lib/onboarding/queries";
import { createTopic } from "@/lib/onboarding/mutations";
import type { TopicFields, TopicPatch } from "@/lib/onboarding/mutations";
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
// text[] columns. Blank entries are dropped: an empty bullet is not a beat of the script.
function textArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
    : [];
}

// Map a request body to a topic field set. `partial` (PATCH) only pulls keys the caller sent,
// so untouched columns keep their value; a full parse (POST) supplies every column with a default.
export function parseTopicFields(body: Record<string, unknown>, partial: true): TopicPatch;
export function parseTopicFields(body: Record<string, unknown>, partial: false): TopicFields;
export function parseTopicFields(
  body: Record<string, unknown>,
  partial: boolean,
): TopicFields | TopicPatch {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const out: TopicPatch = {};
  const set = <K extends keyof TopicFields>(k: K, v: TopicFields[K]) => {
    (out as Record<string, unknown>)[k] = v;
  };

  if (!partial || has("title")) set("title", str(body.title));
  if (!partial || has("additional_context"))
    set("additional_context", str(body.additional_context));
  if (!partial || has("content")) set("content", textArray(body.content));
  if (!partial || has("final_checks")) set("final_checks", textArray(body.final_checks));
  if (!partial || has("order_index")) set("order_index", intOrNull(body.order_index));
  if (!partial || has("urgency")) set("urgency", intOrNull(body.urgency));
  if (!partial || has("mcq_id")) set("mcq_id", intOrNull(body.mcq_id));
  if (!partial || has("product_id")) set("product_id", intOrNull(body.product_id));

  return out;
}

// ?platform=<id> → every onboarding topic on the platform. The single corpus the dashboard
// caches; the product columns and the topic list both derive from it client-side.
export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const topics = await listTopicsByPlatform(platform);
  return NextResponse.json({ topics });
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

  const fields = parseTopicFields(body, false);
  if (!fields.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const topic = await createTopic({ platform_id, ...fields });
    return NextResponse.json({ topic }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
