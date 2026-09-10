import "server-only";

import { getServerClient } from "@/lib/supabase/server";
import type {
  FlagCounts,
  TurnBreakdown,
  TurnSummary,
  TurnTally,
  TranscriptMessage,
  TurnDetail,
  TurnDetailRow,
  TurnFeedRow,
  TurnFlag,
} from "./types";
import { isNoAskTurn, TURN_FLAGS } from "./types";

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

// A count-only request over the same bounds: `head: true` means PostgREST returns the count
// header and no rows at all.
function countBase(q: TurnQuery) {
  return getServerClient()
    .schema("comms")
    .from("ai_turns")
    .select("id,conversations!inner(platform_id)", { count: "exact", head: true })
    .eq("conversations.platform_id", q.platformId)
    .gte("created_at", q.from)
    .lt("created_at", endExclusive(q.to));
}

// Per-flag totals for the range, plus the total of their union (which is smaller than the sum —
// a turn can carry several flags). Five count-only requests, run together.
export async function countFlags(q: TurnQuery): Promise<FlagCounts> {
  const counted = async (filter: string) => {
    const { count, error } = await countBase(q).or(filter);
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

// ── Period summary ────────────────────────────────────────────────────────────
// What the SOP gap report's headline table is built from, computed live for the selected range:
// how the SOP agent judged its own coverage, and the handful of proxies for "how is the AI
// doing". It describes the whole range and deliberately ignores the flag chips — those narrow
// the feed, not the period.
//
// Counted in turns AND in conversations. Ten turns in one conversation are one signal, which is
// the rule the gap report weighs evidence by, and PostgREST cannot count distinct — so the
// conversation figures come from a scan of one light projection rather than a count query.

const SCAN_PAGE = 1000;

interface SummaryRow {
  id: number;
  conversation_id: number | null;
  coverage: string | null;
  gap_reason: string | null;
  // sop_agent->>escalate is text out of PostgREST: "true" / "false".
  escalate: string | null;
  action_type: string | null;
  action_reason: string | null;
}

// jsonb paths only, never a blob: a week of turns (~3.6k rows) is ~200 KB this way, a day ~30 KB.
const SUMMARY_SELECT =
  "id,conversation_id,coverage:sop_agent->>coverage,gap_reason:sop_agent->>gap_reason," +
  "escalate:sop_agent->>escalate,action_type:ai_output->action->>type," +
  "action_reason:ai_output->action->>reason,conversations!inner(platform_id)";

// For the tallies that a filter can express: only the conversation id is needed, the row count
// comes with it.
const CONVERSATION_SELECT = "conversation_id,conversations!inner(platform_id)";

// PostgREST types a string `select` as an opaque row, so the caller names the shape and this
// casts once — the same `as unknown as` the feed and detail reads use.
interface Page {
  data: unknown;
  error: { message: string } | null;
}

// Range-paginated read, page size 1000 — the same shape as the SOP corpus reads. Ordered by id
// so the pages don't overlap.
async function scanPages<T>(build: (from: number, to: number) => PromiseLike<Page>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += SCAN_PAGE) {
    const { data, error } = await build(offset, offset + SCAN_PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < SCAN_PAGE) return out;
  }
}

// ── Tally bookkeeping ─────────────────────────────────────────────────────────

interface Bucket {
  turns: number;
  conversations: Set<number>;
}

function bucket(): Bucket {
  return { turns: 0, conversations: new Set() };
}

function hit(b: Bucket, conversationId: number | null): void {
  b.turns += 1;
  if (conversationId != null) b.conversations.add(conversationId);
}

function tally(b: Bucket): TurnTally {
  return { turns: b.turns, conversations: b.conversations.size };
}

function hitCode(map: Map<string, Bucket>, code: string | null, conversationId: number | null): void {
  if (!code) return;
  let b = map.get(code);
  if (!b) map.set(code, (b = bucket()));
  hit(b, conversationId);
}

// Biggest first: these lists are read as "what is going wrong most", and the tail of a
// model-written reason code is long (15 distinct action.reason values live).
function breakdown(map: Map<string, Bucket>): TurnBreakdown[] {
  return [...map]
    .map(([code, b]) => ({ code, ...tally(b) }))
    .sort((a, b) => b.turns - a.turns || a.code.localeCompare(b.code));
}

// ── The marker filters ────────────────────────────────────────────────────────

// Every gap turn, with the queries it ran. Read as rows rather than counted, because the
// acknowledgement turns have to come out of the coverage picture — a driver who said "thank you"
// needed no SOP, and a failed search on one is not a hole in the corpus — and that test reads
// the turn's own queries. Only gap turns carry a reason, so this is a few hundred rows a week.
interface GapRow {
  id: number;
  queries: string[] | null;
}

async function scanGapTurns(q: TurnQuery): Promise<GapRow[]> {
  return scanPages<GapRow>((lo, hi) =>
    base(q, "id,queries:sop_agent->queries,conversations!inner(platform_id)")
      .eq("sop_agent->>coverage", "gap")
      .order("id")
      .range(lo, hi),
  );
}

// A turn that closed a topic. Topics auto-closed for inactivity are written by a job, not a
// turn, so none of them reach this filter (0 live) — what it counts is the AI ending a subject
// inside the conversation.
const RESOLVED_TOPIC = ["ai_output->topic_writes", "cs", '[{"op":"resolve_topic"}]'] as const;

async function tallyResolvedTopics(q: TurnQuery): Promise<TurnTally> {
  const [column, op, value] = RESOLVED_TOPIC;
  const rows = await scanPages<{ conversation_id: number | null }>((lo, hi) =>
    base(q, CONVERSATION_SELECT).filter(column, op, value).order("id").range(lo, hi),
  );
  const b = bucket();
  for (const r of rows) hit(b, r.conversation_id);
  return tally(b);
}

export async function summarizeTurns(q: TurnQuery): Promise<TurnSummary> {
  const [rows, gapTurns, resolvedTopics] = await Promise.all([
    scanPages<SummaryRow>((lo, hi) => base(q, SUMMARY_SELECT).order("id").range(lo, hi)),
    scanGapTurns(q),
    tallyResolvedTopics(q),
  ]);

  // Gap turns the driver never asked anything on. Dropped from every coverage figure below —
  // they are a property of the conversation, not of the corpus.
  const ackTurns = new Set(gapTurns.filter((t) => isNoAskTurn(t.queries)).map((t) => t.id));

  const all = bucket();
  const scored = bucket();
  const covered = bucket();
  const partial = bucket();
  const gap = bucket();
  const escalated = bucket();
  const askedForHuman = bucket();
  const branchMissing = bucket();
  const missingSop = bucket();
  const acknowledgements = bucket();
  const gapReasons = new Map<string, Bucket>();
  const escalationReasons = new Map<string, Bucket>();

  for (const row of rows) {
    const cid = row.conversation_id;
    hit(all, cid);

    if (row.coverage === "gap" && ackTurns.has(row.id)) {
      hit(acknowledgements, cid);
    } else if (row.coverage) {
      hit(scored, cid);
      if (row.coverage === "covered") hit(covered, cid);
      else if (row.coverage === "partial") hit(partial, cid);
      else if (row.coverage === "gap") {
        hit(gap, cid);
        hitCode(gapReasons, row.gap_reason, cid);
        if (row.gap_reason === "branch_not_in_sop") hit(branchMissing, cid);
        // The agent's own verdict for "the search came back about something else": no SOP on
        // the driver's subject reached the model.
        if (row.gap_reason === "retrieved_off_topic") hit(missingSop, cid);
      }
    }
    if (row.escalate === "true") hit(askedForHuman, cid);
    if (row.action_type === "escalate_to_human") {
      hit(escalated, cid);
      hitCode(escalationReasons, row.action_reason, cid);
    }
  }

  return {
    turns: all.turns,
    conversations: all.conversations.size,
    scored: tally(scored),
    acknowledgements: tally(acknowledgements),
    covered: tally(covered),
    partial: tally(partial),
    gap: tally(gap),
    gapReasons: breakdown(gapReasons),
    escalated: tally(escalated),
    escalationReasons: breakdown(escalationReasons),
    sopAgentAskedForHuman: tally(askedForHuman),
    missingSop: tally(missingSop),
    branchMissing: tally(branchMissing),
    resolvedTopics,
  };
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
