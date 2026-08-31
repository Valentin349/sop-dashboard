// Shapes of comms.ai_turns and the comms.messages transcript around a turn, verified against the
// live DB. The Monitor tab reads these only — nothing here is ever written.
//
// ai_turns is the AI pipeline's own log: one row per turn the agent took, holding the model's
// structured output, the topic-write validation result, and (since 2026-08-27) the SOP retrieval
// agent's self-assessment. There is no platform column — the platform comes from the embedded
// conversation.

// ── Flags ─────────────────────────────────────────────────────────────────────
// The four failure signals the tab triages on. Each maps to one PostgREST filter (see
// FLAG_FILTER in queries.ts); the feed shows the union of the selected ones.
export const TURN_FLAGS = ["escalated", "invalid", "retried", "sop_gap"] as const;
export type TurnFlag = (typeof TURN_FLAGS)[number];

export const FLAG_LABELS: Record<TurnFlag, string> = {
  escalated: "Escalated",
  invalid: "Invalid",
  retried: "Retried",
  sop_gap: "SOP gap",
};

export function isTurnFlag(v: string): v is TurnFlag {
  return (TURN_FLAGS as readonly string[]).includes(v);
}

// ── ai_output ─────────────────────────────────────────────────────────────────
// The reactive agent emits { reply, action, support, topic_writes }; the proactive one emits
// { reply, support, decision_trace } and no action at all. Every field is optional here because
// three agent generations (deliveroo_v11, reactive_agent_v1, proactive_performance_update_v1)
// share the column.

export interface TurnReply {
  text: string | null;
  type: string | null;
  media_id: number | null;
}

// A grounding citation. `id` is a namespaced ref — "sop:919", "issue:271",
// "context:last_driver_message" — which the detail view turns into deep links.
export interface TurnSupport {
  id: string | null;
  quote: string | null;
}

// Present only on an escalate_to_human action. issue_list_id references dashboard.issues_list,
// the table behind the Issue lists tab. can_work is a stringified boolean in the live data.
export interface EscalationIssue {
  note: string | null;
  summary: string | null;
  can_work: string | null;
  issue_list_id: number | null;
}

// action.type is one of reply | ask_clarifying | create_issue_log | escalate_to_human.
// action.reason is written by the model and is NOT an enum — 15 distinct values in the live
// corpus with a long one-off tail, so never switch on it exhaustively.
export interface TurnAction {
  type: string | null;
  reason: string | null;
  issue: EscalationIssue | null;
}

export interface TurnDecisionTrace {
  branch: string | null;
  chosen_subject: string | null;
  suppressed_subject: string | null;
  suppress_reason: string | null;
  reangled: boolean | null;
  blocker_acknowledged: boolean | null;
  signals_used: string[] | null;
}

export interface TurnOutput {
  reply?: TurnReply[] | string[] | null;
  action?: TurnAction | null;
  support?: TurnSupport[] | null;
  decision_trace?: TurnDecisionTrace | null;
  topic_writes?: unknown;
}

// ── validation_result ─────────────────────────────────────────────────────────
// The topic-write validator's verdict. Written on every reactive turn; is_valid mirrors
// validation_result.is_valid. These errors are what the n8n failure emails carry.
export interface ValidationOpResult {
  op: string | null;
  valid: boolean | null;
  errors: string[] | null;
}

export interface ValidationResult {
  is_valid: boolean | null;
  results: ValidationOpResult[] | null;
  batch_errors: string[] | null;
}

// ── sop_agent ─────────────────────────────────────────────────────────────────
// The SOP retrieval agent's self-report. Only on turns from 2026-08-27 onward.
// coverage is "covered" | "partial" | "gap"; gap_reason is a short code
// (branch_not_in_sop, retrieved_off_topic, action_request_not_procedure, …).
export interface SopAgentPick {
  sop_id: number | null;
  why: string | null;
  confidence: string | null;
}

export interface SopAgent {
  ran: boolean | null;
  coverage: string | null;
  gap_reason: string | null;
  escalate: boolean | null;
  escalate_summary: string | null;
  sops: SopAgentPick[] | null;
  sop_ids: number[] | null;
  bundle_sop_ids: number[] | null;
  dropped_ids: number[] | null;
  overrides: unknown[] | null;
  queries: string[] | null;
  search_count: number | null;
  harness_error: string | null;
}

// ── Rows ──────────────────────────────────────────────────────────────────────

// The feed projection. Deliberately excludes ai_output/validation_result/sop_agent in full —
// only the jsonb paths the row needs — so a page of 50 stays a few KB rather than a few hundred.
export interface TurnFeedRow {
  id: number;
  created_at: string;
  ai_name: string | null;
  ai_mode: string | null;
  is_valid: boolean | null;
  retry_count: number | null;
  conversation_id: number | null;
  platform_id: number | null;
  action: TurnAction | null;
  coverage: string | null;
  gap_reason: string | null;
  // Carried in the feed projection (+~6.6 KB per page of 50) because the badge names the real
  // error, and only 13% of invalid turns put one in batch_errors — the rest are per-op.
  validation_result: ValidationResult | null;
}

// The detail projection: everything the feed row has, plus the full blobs and provenance.
export interface TurnDetailRow extends TurnFeedRow {
  ai_output: TurnOutput | null;
  sop_agent: SopAgent | null;
  ai_model: string | null;
  prompt_commit_version: string | null;
  version: string | null;
  accept: boolean | null;
  n8n_workflow_id: string | null;
  n8n_workflow_execution_id: string | null;
  chatwoot_conversation_id: string | null;
  driver_id: number | null;
}

// One comms.messages row in the transcript around a turn. driver_text is the message in the
// driver's language; agent_text is the English canonical (a translation on inbound rows), so
// the view prefers agent_text and keeps driver_text as the original.
export interface TranscriptMessage {
  id: number;
  created_at: string;
  sender_type: string | null;
  agent_id: number | null;
  msg_type: string | null;
  driver_text: string | null;
  agent_text: string | null;
  ai_action_type: string | null;
}

export interface TurnDetail {
  turn: TurnDetailRow;
  transcript: TranscriptMessage[];
}

export type FlagCounts = Record<TurnFlag, number> & { total: number };

// ── Derived helpers (shared by the feed row and the detail header) ─────────────

export function flagsForTurn(row: TurnFeedRow): TurnFlag[] {
  const flags: TurnFlag[] = [];
  if (row.action?.type === "escalate_to_human") flags.push("escalated");
  if (row.is_valid === false) flags.push("invalid");
  if ((row.retry_count ?? 0) > 0) flags.push("retried");
  if (row.coverage === "gap" || row.coverage === "partial") flags.push("sop_gap");
  return flags;
}

// Reason codes are snake_case machine strings (branch_not_in_sop, unclear_after_clarification).
// Shown as-is they read as debug output, so sentence-case them for display — the raw code stays
// available as a tooltip wherever this is used.
const ACRONYMS = new Set(["sop", "sops", "ai", "mcq", "id", "ids", "kpi", "gps"]);

export function humanizeReason(code: string | null | undefined): string | null {
  const c = (code ?? "").trim();
  if (!c) return null;
  const words = c
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w));
  if (words.length === 0) return null;
  const [first, ...rest] = words;
  return [ACRONYMS.has(first.toLowerCase()) ? first : first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

// Validation errors are written for a developer and run long — up to 201 chars in the live
// corpus, most of it a remediation clause after a ";" or "--". A badge needs the claim only; the
// full text still shows as the row's headline and in the detail rail.
const BADGE_MAX = 64;

export function shortenError(text: string | null): string | null {
  if (!text) return null;
  const head = text.split(/\s+--\s+|;/)[0].trim();
  if (!head) return null;
  return head.length > BADGE_MAX ? `${head.slice(0, BADGE_MAX - 1).trimEnd()}…` : head;
}

// The validator reports failures in two places and mostly uses the second: across 300 live
// invalid turns only 39 had a batch_error, while 259 had per-op errors only. Check both.
export function firstValidationError(v: ValidationResult | null): string | null {
  const batch = (v?.batch_errors ?? []).find((e) => e?.trim());
  if (batch) return batch;
  for (const r of v?.results ?? []) {
    const err = (r.errors ?? []).find((e) => e?.trim());
    if (err) return r.op ? `${r.op}: ${err}` : err;
  }
  return null;
}

// What each of a turn's flags actually says. The badge shows `label` (the specific reason) and
// takes its colour from `flag` (the category) — the filter chips above the feed double as the
// colour legend, so the category never needs spelling out twice.
export interface FlagDetail {
  flag: TurnFlag;
  label: string;
  // The underlying machine string, when the label is a prettified version of one.
  code: string | null;
}

export function flagDetails(row: TurnFeedRow): FlagDetail[] {
  const out: FlagDetail[] = [];

  if (row.action?.type === "escalate_to_human") {
    const reason = row.action.reason ?? null;
    out.push({
      flag: "escalated",
      label: humanizeReason(reason) ?? "Escalated to human",
      code: reason,
    });
  }
  if (row.is_valid === false) {
    const err = firstValidationError(row.validation_result);
    out.push({
      flag: "invalid",
      label: shortenError(err) ?? "Failed validation",
      // The badge shows the claim; the tooltip carries the remediation clause it dropped.
      code: err && shortenError(err) !== err ? err : null,
    });
  }
  if ((row.retry_count ?? 0) > 0) {
    out.push({ flag: "retried", label: `Retried ${row.retry_count}×`, code: null });
  }
  if (row.coverage === "gap" || row.coverage === "partial") {
    const label =
      humanizeReason(row.gap_reason) ??
      (row.coverage === "partial" ? "Partial SOP coverage" : "SOP gap");
    out.push({ flag: "sop_gap", label, code: row.gap_reason });
  }
  return out;
}

// The turn's headline: what went wrong, in the most specific words available. An escalation
// carries the model's own prose summary, which beats any code; a validation failure carries the
// full error the badge had to truncate. Never returns a bare category word.
export function summaryForTurn(row: TurnFeedRow): string {
  const esc = row.action?.type === "escalate_to_human" ? row.action : null;
  const summary = esc?.issue?.summary?.trim();
  if (summary) return summary;
  if (row.is_valid === false) {
    const err = firstValidationError(row.validation_result);
    if (err) return err;
  }
  const details = flagDetails(row);
  return details[0]?.label ?? "Flagged";
}

// A gap or a retry says nothing beyond its badge, so printing both would repeat the same words —
// there the badges are the row. A validation failure keeps its headline even though the badge is
// a prefix of it: the badge had to drop the remediation clause, and that clause is what makes the
// error actionable at a glance. Suppress on exact equality only, so no text is ever lost.
export function headlineAddsDetail(row: TurnFeedRow): boolean {
  const headline = summaryForTurn(row);
  return !flagDetails(row).some((d) => d.label === headline);
}

// "sop:919" / "issue:271" / "context:last_driver_message" → a typed ref the view can link.
//
// Only `sop` and `issue` address rows this dashboard can open: sop → ai_agent.knowledge_base,
// issue → dashboard.issues_list. `issue_history:` and `issue_detail:` look linkable but are NOT —
// their ids are dashboard.issue_logs rows (a driver's logged instances, ids in the thousands),
// not issue definitions (issues_list tops out at 278). They get their own kind so they render as
// labelled text rather than being mistaken for `issue:` refs later.
export interface SupportRef {
  kind: "sop" | "issue" | "issue_log" | "context" | "other";
  id: number | null;
  raw: string;
}

const REF_KINDS: Record<string, SupportRef["kind"]> = {
  sop: "sop",
  issue: "issue",
  issue_history: "issue_log",
  issue_detail: "issue_log",
  context: "context",
};

export function parseSupportRef(raw: string | null): SupportRef {
  const s = (raw ?? "").trim();
  const m = /^([a-z_]+):(.*)$/.exec(s);
  const kind = m ? REF_KINDS[m[1]] : undefined;
  if (!m || !kind) return { kind: "other", id: null, raw: s };
  const n = Number(m[2]);
  return { kind, id: Number.isInteger(n) ? n : null, raw: s };
}
