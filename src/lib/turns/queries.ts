import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type {
  FlagCounts,
  TranscriptMessage,
  TurnDetail,
  TurnDetailRow,
  TurnFeedRow,
  TurnFlag,
} from "./types";
import { TURN_FLAGS } from "./types";

// Reads from comms.ai_turns — the AI pipeline's own turn log, a different schema than SOPs
// (same move issues/queries.ts makes for `dashboard`). No caching: the tab monitors production,
// so every filter change refetches.
//
// Unlike the SOP / Issue / Onboarding tabs there is NO corpus to seed: 32k turns and growing by
// ~450/day, so the feed is server-filtered and keyset-paginated instead of shipped to the
// browser. Nothing here fetches all pages.

const PAGE_SIZE = 50;

// Each flag as one PostgREST filter fragment. Kept as raw strings because two of them address
// jsonb paths, which only the raw filter syntax can express; supabase-js passes them through
// .or() untouched (verified against the live API).
const FLAG_FILTER: Record<TurnFlag, string> = {
  escalated: "ai_output->action->>type.eq.escalate_to_human",
  invalid: "is_valid.is.false",
  retried: "retry_count.gt.0",
  sop_gap: "sop_agent->>coverage.in.(gap,partial)",
};

// Feed projection — jsonb *paths*, never the whole ai_output blob (a single turn's output runs
// to several KB; 50 of them would dwarf the rest of the page).
const FEED_SELECT =
  "id,created_at,ai_name,ai_mode,is_valid,retry_count,conversation_id," +
  "action:ai_output->action,coverage:sop_agent->>coverage,gap_reason:sop_agent->>gap_reason," +
  "validation_result,conversations!inner(platform_id)";

const DETAIL_SELECT =
  "id,created_at,ai_name,ai_mode,is_valid,retry_count,conversation_id,accept,version," +
  "ai_output,validation_result,sop_agent,ai_model,prompt_commit_version," +
  "n8n_workflow_id,n8n_workflow_execution_id," +
  "conversations!inner(platform_id,chatwoot_conversation_id,driver_id)";

export interface TurnQuery {
  platformId: number;
  // Inclusive date bounds, "YYYY-MM-DD".
  from: string;
  to: string;
  // Empty = every flag (the union of all four).
  flags?: TurnFlag[];
}

// The embedded conversation arrives nested; the rest of the app works with a flat row.
type Embedded<T> = T & {
  conversations?: {
    platform_id: number | null;
    chatwoot_conversation_id?: string | null;
    driver_id?: number | null;
  } | null;
};

// `to` is an inclusive calendar day, but created_at is a timestamp — compare against the start
// of the following day rather than truncating, so turns later than 00:00 on `to` still count.
function endExclusive(to: string): string {
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function orFilter(flags: TurnFlag[] | undefined): string {
  const chosen = flags && flags.length > 0 ? flags : TURN_FLAGS;
  return chosen.map((f) => FLAG_FILTER[f]).join(",");
}

// Every flagged-turn query shares these bounds; only the flag predicate and paging differ.
function base(q: TurnQuery, select: string) {
  return getServerClient()
    .schema("comms")
    .from("ai_turns")
    .select(select)
    .eq("conversations.platform_id", q.platformId)
    .gte("created_at", q.from)
    .lt("created_at", endExclusive(q.to));
}

function flatten<T>(row: Embedded<T>): T & { platform_id: number | null } {
  const { conversations, ...rest } = row;
  return { ...(rest as T), platform_id: conversations?.platform_id ?? null };
}

// One page of flagged turns, newest first. Keyset-paginated on id (not offset): the feed is a
// descending scan over a 32k-row table, and offset paging re-walks every skipped row.
export async function listFlaggedTurns(
  q: TurnQuery,
  cursor?: number | null,
  limit = PAGE_SIZE,
): Promise<{ rows: TurnFeedRow[]; nextCursor: number | null }> {
  let query = base(q, FEED_SELECT).or(orFilter(q.flags));
  if (cursor != null) query = query.lt("id", cursor);

  const { data, error } = await query.order("id", { ascending: false }).limit(limit);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as Embedded<TurnFeedRow>[]).map((r) =>
    flatten<TurnFeedRow>(r),
  );
  // A short page means the scan reached the end of the range; only a full page can have more.
  const nextCursor = rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null;
  return { rows, nextCursor };
}

// Per-flag totals for the range, plus the total of their union (which is smaller than the sum —
// a turn can carry several flags). Five count-only requests, run together: `head: true` means
// PostgREST returns the count header and no rows at all.
export async function countFlags(q: TurnQuery): Promise<FlagCounts> {
  const counted = async (filter: string) => {
    const { count, error } = await getServerClient()
      .schema("comms")
      .from("ai_turns")
      .select("id,conversations!inner(platform_id)", { count: "exact", head: true })
      .eq("conversations.platform_id", q.platformId)
      .gte("created_at", q.from)
      .lt("created_at", endExclusive(q.to))
      .or(filter);
    if (error) throw error;
    return count ?? 0;
  };

  const [escalated, invalid, retried, sop_gap, total] = await Promise.all([
    counted(FLAG_FILTER.escalated),
    counted(FLAG_FILTER.invalid),
    counted(FLAG_FILTER.retried),
    counted(FLAG_FILTER.sop_gap),
    counted(orFilter(q.flags)),
  ]);
  return { escalated, invalid, retried, sop_gap, total };
}

// The conversation around a turn, so the reviewer can judge it without opening Chatwoot.
// Two bounded reads rather than one window: the messages *before* the turn are the context the
// model saw, the ones after are what happened next, and each needs its own ordering to be
// bounded from the turn outward.
const BEFORE = 20;
const AFTER = 8;

async function loadTranscript(
  conversationId: number,
  at: string,
): Promise<TranscriptMessage[]> {
  const db = getServerClient();
  const cols =
    "id,created_at,sender_type,agent_id,msg_type,driver_text,agent_text,ai_action_type";

  const [before, after] = await Promise.all([
    db
      .schema("comms")
      .from("messages")
      .select(cols)
      .eq("conversation_id", conversationId)
      .lte("created_at", at)
      .order("created_at", { ascending: false })
      .limit(BEFORE),
    db
      .schema("comms")
      .from("messages")
      .select(cols)
      .eq("conversation_id", conversationId)
      .gt("created_at", at)
      .order("created_at", { ascending: true })
      .limit(AFTER),
  ]);
  if (before.error) throw before.error;
  if (after.error) throw after.error;

  return [
    ...((before.data ?? []) as TranscriptMessage[]).slice().reverse(),
    ...((after.data ?? []) as TranscriptMessage[]),
  ];
}

export async function getTurnDetail(id: number): Promise<TurnDetail | null> {
  const { data, error } = await getServerClient()
    .schema("comms")
    .from("ai_turns")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Embedded<TurnDetailRow>;
  const turn: TurnDetailRow = {
    ...flatten<TurnDetailRow>(row),
    chatwoot_conversation_id: row.conversations?.chatwoot_conversation_id ?? null,
    driver_id: row.conversations?.driver_id ?? null,
  };
  const transcript = turn.conversation_id
    ? await loadTranscript(turn.conversation_id, turn.created_at)
    : [];
  return { turn, transcript };
}
