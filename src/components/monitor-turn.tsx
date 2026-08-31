"use client";

import { memo } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

import { issueHref } from "@/lib/issues/nav";
import { sopHref } from "@/lib/sops/nav";
import { chatwootUrl, n8nExecutionUrl } from "@/lib/turns/links";
import {
  flagDetails,
  humanizeReason,
  parseSupportRef,
  summaryForTurn,
  type TranscriptMessage,
  type TurnDetail,
  type TurnReply,
} from "@/lib/turns/types";
import { cn } from "@/lib/utils";
import { FlagBadge } from "./monitor-flags";

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

type TurnOutputReply = TurnReply[] | string[] | null | undefined;
interface ReplyPart {
  text: string;
  mediaId: number | null;
}

// The reactive agents emit reply as [{ text, type, media_id }]; the proactive one emits plain
// strings. Both share the column, so normalise before rendering.
function replyTexts(reply: TurnOutputReply): ReplyPart[] {
  if (!Array.isArray(reply)) return [];
  // The union of the two array shapes defeats flatMap's overloads, so widen the element first.
  return (reply as Array<string | TurnReply>).flatMap<ReplyPart>((part) => {
    if (typeof part === "string") {
      return part.trim() ? [{ text: part, mediaId: null }] : [];
    }
    if (part.type === "media" && part.media_id != null) {
      return [{ text: `[media #${part.media_id}]`, mediaId: part.media_id }];
    }
    return part.text?.trim() ? [{ text: part.text, mediaId: null }] : [];
  });
}

// ── Transcript ────────────────────────────────────────────────────────────────
// Laid out as a chat: the driver on the left, everything sent outward on the right, so who is
// talking reads from position before you read any label. `agent` is a HUMAN operator and gets the
// loudest treatment — a human in the thread is usually the reason the turn is worth reviewing.

interface SenderStyle {
  label: string;
  align: "left" | "right";
  bubble: string;
  dot: string;
  quiet?: boolean;
}

const SENDERS: Record<string, SenderStyle> = {
  driver: {
    label: "Driver",
    align: "left",
    bubble: "bg-card border-border",
    dot: "bg-sky-500",
  },
  ai: {
    label: "AI",
    align: "right",
    bubble: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  agent: {
    label: "Human agent",
    align: "right",
    bubble: "bg-amber-500/15 border-amber-500/50",
    dot: "bg-amber-500",
  },
  performance_trigger: {
    label: "Performance trigger",
    align: "right",
    bubble: "bg-muted/60 border-border",
    dot: "bg-muted-foreground/50",
    quiet: true,
  },
  system: {
    label: "System",
    align: "right",
    bubble: "bg-muted/60 border-border",
    dot: "bg-muted-foreground/40",
    quiet: true,
  },
};

const UNKNOWN_SENDER: SenderStyle = {
  label: "Unknown",
  align: "right",
  bubble: "bg-muted/40 border-border",
  dot: "bg-muted-foreground/40",
  quiet: true,
};

function Bubble({ msg, atTurn }: { msg: TranscriptMessage; atTurn: boolean }) {
  const s = SENDERS[msg.sender_type ?? ""] ?? UNKNOWN_SENDER;
  // agent_text is the English canonical — a translation on inbound rows, the source on outbound
  // ones. Only English is shown; driver_text holds the same message in the driver's language.
  const text = msg.agent_text?.trim() || msg.driver_text?.trim() || "";
  const left = s.align === "left";

  return (
    <div className={cn("flex flex-col", left ? "items-start" : "items-end")}>
      <p className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", s.dot)} />
        <span className="font-medium text-foreground/70">
          {s.label}
          {msg.sender_type === "agent" && msg.agent_id != null && ` #${msg.agent_id}`}
        </span>
        <span className="font-mono">{formatTime(msg.created_at)}</span>
        {msg.msg_type && msg.msg_type !== "text_only" && <span>{msg.msg_type}</span>}
      </p>
      <div
        className={cn(
          "mt-0.5 max-w-[85%] rounded-lg border px-3 py-2",
          s.bubble,
          s.quiet && "opacity-75",
          atTurn && "ring-2 ring-foreground/25",
        )}
      >
        {atTurn && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-foreground/60">
            This turn
          </p>
        )}
        <p
          className={cn(
            "whitespace-pre-wrap break-words leading-relaxed",
            s.quiet ? "text-[12px] text-foreground/75" : "text-[13px] text-foreground/90",
          )}
        >
          {text || <span className="italic text-muted-foreground">(no text)</span>}
        </p>
      </div>
    </div>
  );
}

function Transcript({
  messages,
  turnAt,
}: {
  messages: TranscriptMessage[];
  turnAt: string;
}) {
  if (messages.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No messages found.</p>;
  }
  const turnMs = new Date(turnAt).getTime();
  // Derived per item rather than tracked in a running variable, so the pass stays pure.
  const items = messages.map((m, i) => ({
    msg: m,
    day: formatDay(m.created_at),
    startsDay: i === 0 || formatDay(m.created_at) !== formatDay(messages[i - 1].created_at),
    // The turn's own outbound message: the AI row within a minute of the turn's timestamp.
    atTurn:
      m.sender_type === "ai" &&
      Math.abs(new Date(m.created_at).getTime() - turnMs) < 60_000,
  }));

  return (
    <ul className="space-y-3">
      {items.map(({ msg, day, startsDay, atTurn }) => (
        <li key={msg.id}>
          {startsDay && (
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {day}
              <span className="h-px flex-1 bg-border" />
            </p>
          )}
          <Bubble msg={msg} atTurn={atTurn} />
        </li>
      ))}
    </ul>
  );
}

// A link out to a system that produced this turn.
function OutLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

export const MonitorTurn = memo(function MonitorTurn({
  detail,
  platformName,
}: {
  detail: TurnDetail;
  platformName: string;
}) {
  const { turn, transcript } = detail;
  const details = flagDetails(turn);
  const action = turn.action ?? turn.ai_output?.action ?? null;
  const escalation = action?.type === "escalate_to_human" ? action : null;
  const sop = turn.sop_agent;
  const validation = turn.validation_result;
  const replies = replyTexts(turn.ai_output?.reply);
  const support = turn.ai_output?.support ?? [];
  const trace = turn.ai_output?.decision_trace ?? null;

  const validationErrors = [
    ...(validation?.batch_errors ?? []),
    ...(validation?.results ?? []).flatMap((r) =>
      (r.errors ?? []).map((e) => `${r.op ?? "op"}: ${e}`),
    ),
  ];

  const chatwoot = chatwootUrl(turn.chatwoot_conversation_id);
  // Built from the row's own workflow id, so a legacy turn links to the workflow it actually ran on.
  const n8n = n8nExecutionUrl(turn.n8n_workflow_id, turn.n8n_workflow_execution_id);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 border-b px-8 py-3 text-[13px] text-muted-foreground">
        <span>{platformName}</span>
        <ChevronRight className="size-3.5 opacity-60" />
        <span className="min-w-0 shrink-0 truncate font-medium text-foreground">
          Turn #{turn.id}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {chatwoot && <OutLink href={chatwoot}>Chatwoot</OutLink>}
          {n8n && <OutLink href={n8n}>n8n run</OutLink>}
        </span>
      </div>

      {/* Two columns: the conversation is the narrative and gets the room; everything that
          explains the turn sits in a rail beside it. Below xl the rail stacks underneath. */}
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {/* ── Main: what happened ──────────────────────────────────────────── */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            <header className="mb-8">
              <h1 className="font-serif text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">
                {summaryForTurn(turn)}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {details.map((d) => (
                  <FlagBadge key={d.flag} detail={d} />
                ))}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                <span className="font-mono">{formatStamp(turn.created_at)}</span>
                <span className="opacity-50">·</span>
                <span>{turn.ai_name ?? "unknown agent"}</span>
                {turn.ai_mode && (
                  <>
                    <span className="opacity-50">·</span>
                    <span>{turn.ai_mode}</span>
                  </>
                )}
                {turn.ai_model && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="font-mono">{turn.ai_model}</span>
                  </>
                )}
                <span className="opacity-50">·</span>
                <span className="select-all">conv {turn.conversation_id ?? "—"}</span>
                {turn.driver_id != null && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="select-all">driver {turn.driver_id}</span>
                  </>
                )}
              </p>
            </header>

            {replies.length > 0 && (
              <section className="mb-8">
                <SectionLabel>What the AI produced</SectionLabel>
                <div className="space-y-2">
                  {replies.map((r, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-wrap break-words rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] leading-relaxed text-foreground/90"
                    >
                      {r.text}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <section>
              <SectionLabel>Conversation</SectionLabel>
              <Transcript messages={transcript} turnAt={turn.created_at} />
            </section>
          </div>
        </div>

        {/* ── Rail: why it is in the queue, and what it was grounded in ─────── */}
        <aside className="min-h-0 shrink-0 overflow-y-auto border-t bg-sidebar/40 px-5 py-6 xl:w-[400px] xl:border-l xl:border-t-0">
          <div className="space-y-7">
            <section>
              <SectionLabel>Why flagged</SectionLabel>
              <div className="space-y-3">
                {escalation && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-medium text-amber-900 dark:text-amber-300">
                        {humanizeReason(escalation.reason) ?? "Escalated to human"}
                      </span>
                      {escalation.issue?.can_work != null && (
                        <span className="text-amber-900/80 dark:text-amber-300/80">
                          can work: {String(escalation.issue.can_work)}
                        </span>
                      )}
                    </p>
                    {escalation.issue?.summary && (
                      <p className="mt-2 text-[13px] font-medium text-foreground">
                        {escalation.issue.summary}
                      </p>
                    )}
                    {escalation.issue?.note && (
                      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
                        {escalation.issue.note}
                      </p>
                    )}
                    {escalation.issue?.issue_list_id != null && (
                      <Link
                        href={issueHref({
                          platform: turn.platform_id,
                          issue: escalation.issue.issue_list_id,
                        })}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[12px] transition-colors hover:bg-accent"
                        title="Open the matched issue in the Issue lists tab"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">
                          issue #{escalation.issue.issue_list_id}
                        </span>
                        <span>Open in Issue lists</span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </Link>
                    )}
                  </div>
                )}

                {validationErrors.length > 0 && (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                    <p className="text-[12px] font-medium text-red-900 dark:text-red-300">
                      Topic writes failed validation
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {validationErrors.map((e, i) => (
                        <li key={i} className="text-[12px] leading-relaxed text-foreground/85">
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(turn.retry_count ?? 0) > 0 && (
                  <p className="text-[12px] text-foreground/85">
                    Pipeline retried this turn {turn.retry_count}×.
                  </p>
                )}

                {sop && (sop.coverage === "gap" || sop.coverage === "partial") && (
                  <div className="rounded-md border border-violet-300 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
                    <p className="text-[12px] font-medium text-violet-900 dark:text-violet-300">
                      {humanizeReason(sop.gap_reason) ??
                        (sop.coverage === "partial" ? "Partial SOP coverage" : "SOP gap")}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-violet-900/70 dark:text-violet-300/70">
                      coverage: {sop.coverage}
                      {sop.gap_reason ? ` · ${sop.gap_reason}` : ""}
                    </p>
                    {sop.escalate_summary && (
                      <p className="mt-2 text-[12px] text-foreground/85">{sop.escalate_summary}</p>
                    )}
                  </div>
                )}

                {details.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    No failure detail recorded on this turn.
                  </p>
                )}
              </div>
            </section>

            {sop && (
              <section>
                <SectionLabel>SOP retrieval</SectionLabel>
                {(sop.queries ?? []).length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {(sop.queries ?? []).map((q, i) => (
                      <p
                        key={i}
                        className="whitespace-pre-wrap rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground"
                      >
                        {q}
                      </p>
                    ))}
                  </div>
                )}
                {(sop.sops ?? []).length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No SOPs retrieved.</p>
                ) : (
                  <ul className="space-y-2">
                    {(sop.sops ?? []).map((pick, i) => {
                      // bundle_sop_ids are the ones actually handed to the model; the rest were
                      // retrieved and dropped. That distinction is the useful part.
                      const used = (sop.bundle_sop_ids ?? []).includes(pick.sop_id ?? -1);
                      return (
                        <li key={`${pick.sop_id}-${i}`} className="rounded-md border bg-card p-2.5">
                          <p className="flex flex-wrap items-center gap-2 text-[12px]">
                            {pick.sop_id != null ? (
                              <Link
                                href={sopHref({ platform: turn.platform_id, sop: pick.sop_id })}
                                className="inline-flex items-center gap-1 font-mono text-[11px] underline-offset-2 hover:underline"
                                title="Open this SOP in the Knowledge base"
                              >
                                sop #{pick.sop_id}
                                <ExternalLink className="size-3 text-muted-foreground" />
                              </Link>
                            ) : (
                              <span className="font-mono text-[11px]">sop —</span>
                            )}
                            {pick.confidence && (
                              <span className="rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {pick.confidence}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[11px]",
                                used
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {used ? "used in bundle" : "dropped"}
                            </span>
                          </p>
                          {pick.why && (
                            <p className="mt-1 text-[12px] leading-relaxed text-foreground/85">
                              {pick.why}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {support.length > 0 && (
              <section>
                <SectionLabel>Grounding</SectionLabel>
                <ul className="space-y-2">
                  {support.map((s, i) => {
                    const ref = parseSupportRef(s.id);
                    const href =
                      ref.kind === "sop" && ref.id != null
                        ? sopHref({ platform: turn.platform_id, sop: ref.id })
                        : ref.kind === "issue" && ref.id != null
                          ? issueHref({ platform: turn.platform_id, issue: ref.id })
                          : null;
                    return (
                      <li key={i} className="border-l-2 py-1 pl-3">
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            {ref.raw}
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : (
                          <span
                            className="font-mono text-[11px] text-muted-foreground"
                            title={
                              ref.kind === "issue_log"
                                ? "A logged issue instance (dashboard.issue_logs), not an issue definition — nothing to open here"
                                : undefined
                            }
                          >
                            {ref.raw}
                          </span>
                        )}
                        {s.quote && (
                          <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/85">
                            “{s.quote}”
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {trace && (
              <section>
                <SectionLabel>Decision trace</SectionLabel>
                <dl className="space-y-1 text-[12px]">
                  {Object.entries(trace).map(([k, v]) =>
                    v == null || (Array.isArray(v) && v.length === 0) ? null : (
                      <div key={k} className="flex gap-2">
                        <dt className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="min-w-0 text-foreground/85">
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            )}

            <section className="border-t pt-4">
              <p className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
                <span className="select-all">turn {turn.id}</span>
                {turn.n8n_workflow_execution_id && (
                  <span>
                    exec{" "}
                    {n8n ? (
                      <a
                        href={n8n}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {turn.n8n_workflow_execution_id}
                      </a>
                    ) : (
                      <span className="select-all">{turn.n8n_workflow_execution_id}</span>
                    )}
                  </span>
                )}
                {turn.n8n_workflow_id && (
                  <span className="select-all">wf {turn.n8n_workflow_id}</span>
                )}
                {turn.prompt_commit_version && (
                  <span className="select-all">prompt {turn.prompt_commit_version}</span>
                )}
                {turn.chatwoot_conversation_id && (
                  <span>
                    chatwoot{" "}
                    {chatwoot ? (
                      <a
                        href={chatwoot}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {turn.chatwoot_conversation_id}
                      </a>
                    ) : (
                      <span className="select-all">{turn.chatwoot_conversation_id}</span>
                    )}
                  </span>
                )}
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
});
