@AGENTS.md

# sop-dashboard

Internal dashboard to **show and manage SOPs** in Supabase `ai_agent.knowledge_base` — the
RAG source consumed by the `driver-context-manager` service (`comms.topic_sops.sop_id` →
`ai_agent.knowledge_base.id`). Scaffold stage; the real UI is TBD.

## Stack

Next.js 16 (App Router) + TypeScript · Tailwind v4 + shadcn/ui · `@supabase/supabase-js`.
npm. Node 24. Supabase Auth: access needs a `viewer`/`admin` role in the user's
`app_metadata` (`src/lib/auth/session.ts`); route handlers guard with `requireApi()`.

> Next.js is v16 — newer than most training data. Conventions may differ; check
> `node_modules/next/dist/docs/` before writing framework code (see AGENTS.md). `cacheComponents`
> is OFF, so route-segment config (`export const dynamic`) is still valid.

## Data access — the load-bearing rule

**Service-role key, server-side only.** The `ai_agent` schema is NOT exposed to the Supabase
`anon` role (`permission denied for schema ai_agent`), so the browser cannot reach it. All DB
access goes through `src/lib/supabase/server.ts`, guarded by `import "server-only"`.

- **Never** import `@/lib/supabase/server` (or anything in `src/lib/sops/`) into a Client
  Component — the `server-only` guard fails the build, but don't rely on it; keep DB reads in
  Server Components / route handlers / server actions.
- **Never** add a `NEXT_PUBLIC_` prefix to the service-role key, or log it.
- The client defaults to schema `ai_agent`. The platforms lookup lives in `public` →
  `db.schema("public").from("platforms")`.
- Add queries to `src/lib/sops/queries.ts`; types to `src/lib/sops/types.ts`. Reads are
  range-paginated (page size 1000), mirroring `driver-context-manager/data/database_read.py`.

## Schema (verified against the live DB)

- `ai_agent.knowledge_base` (~879 rows): `id, created_at, title, content, document_id,
  platform_id, category_id, is_come_back, metafield, data_source`. `metafield` is a json-ish
  text blob (`category`, `function`, `media_paths`).
- `ai_agent.knowledge_base_categories`: `id, created_at, name, platform_id, description`.
- `public.platforms`: `id, code, name, fleet_partner, bucket`. IDs: 1 Yango · 8 Deliveroo ·
  12 Bolt. Distribution: 8→716, 1→137, 12→26.

Creds live in `.env.local` (gitignored), copied from `driver-context-manager/.env`.

## Run

```bash
npm run dev     # http://localhost:3000
npm run build   # also type-checks; build FAILS if server-only leaks to a client bundle
```

`next.config.ts` turns off `experimental.reactDebugChannel` in dev. Next 16's React debug
channel decides "this document came from the browser cache" by reading
`performance.getEntriesByType("navigation")[0].transferSize === 0`; when it then can't restore
the matching `sessionStorage` entry it calls `location.reload()`
(`client/dev/debug-channel.js`). On `/` that read is 0 on every load here, so the reload
re-enters the same check — a silent endless full-page reload loop (~1.6 loads a second, each a
real `force-dynamic` server render, no console output at all). Cost of the switch: React's
extra debug info in dev. Dev only — `next build`/`next start` keep the default.

The auth gate lives in `src/proxy.ts` (Next 16's renamed `middleware` file convention: export
`proxy`, Node.js runtime, a `runtime` config option throws).

## Structured SOPs (Anda only)

Platform 1 (`anda`) has been rewritten to the house standard in
`src/content/sop-writing-standard.md` — fixed blocks (`Driver says`, `Environment`, `Ask first`,
`Resolution`, `Cause`; `Location`/`Links` for reference entries), branches labelled `A.`/`B.`,
example replies inline. The other platforms still hold the old free-text SOPs.

- `src/lib/sops/structure.ts` parses the stored body into those blocks and serializes it back.
  Parse → serialize round-trips the live Anda corpus (107/134 byte-identical, 24 whitespace-only,
  3 that repair a source typo). Content is still one plain-text blob in the DB — the structure is
  a view over it, never a new column.
- `src/lib/sops/body.ts` is the line-level pass inside a block (steps, sub-bullets, IF/THEN,
  example replies). Split from the component so it can be run without a DOM.
- The view (`sop-structured-view.tsx`) and the section editor (`sop-structured-editor.tsx`) are
  gated on the platform code via `platformSupportsStructure`. Add a platform to that set only once
  its corpus is rewritten; everything else keeps the plain textarea and pre-wrap view. A SOP that
  doesn't parse into blocks falls back to plain rendering too.
- The editor writes nothing on mount: an untouched SOP keeps its stored text byte for byte. Its
  "Edit as plain text" toggle is the escape hatch when the structure gets in the way.
- Two parser rules exist to stop text disappearing on save: a heading that appears twice has both
  bodies **merged** into one block (`doc.duplicates` flags it, and the editor says so), and a
  section left empty is **not** serialized — a bare `Cause` heading would otherwise enter the
  search index as a word of the body (standard §1). Two live rows (1131, 1132) carry such an
  empty `Environment`; it drops the first time either is saved.
- The Resolution "After the branches" field renders only for SOPs that already hold that text.
  The standard's shape is intro → branches (§2.3, §8); the parser supports a trailing run only
  because some rows have one, so there is no way to create a new one.
- Unsaved changes are tracked in `SopEditor` and reported up via `onDirtyChange` — a ref in
  Dashboard, since it fires per keystroke and must not re-render the tree. Cancel, switching
  SOP / category / platform, and closing the tab all confirm first. The sidebar's writing-standard
  link opens in a new tab for the same reason.

## Variables

A value that appears in several SOPs — a weekly earnings target, a waiting time, a phone model —
is defined once in `ai_agent.sop_variables` (platform-scoped) and written into a body as
`{{NAME}}`. Schema and the reasoning live in `db/sop-variables.sql` (untracked).

**`knowledge_base.content` holds the placeholders — it is the authored text.** Nothing reads it
at runtime: the agent's `sop_search` returns `public.documents.content` from the vector store. So
the substitution happens once, in the n8n workflow that builds the embeddings — it looks each
`{{NAME}}` up in `sop_variables` by name + `platform_id` and replaces it before embedding. The
embedding therefore holds "350,000Kz", never a placeholder, which is what keeps §1 of the writing
standard true: every word of the body is a word a driver's message can match.

Consequences worth knowing:

- **The rebuild is a manual trigger, and `documents` does not track `content` edits.** Changing a
  value is live in the dashboard immediately and reaches drivers only after the next rebuild —
  the standard says this in §9. The panel says so too rather than implying it is live.
- **Never write a placeholder into a body the workflow cannot yet resolve.** A rebuild in that
  window embeds a literal `{{NAME}}` and the agent quotes it at drivers.
- `createSop`/`updateSop` **validate** rather than render: a body naming a variable that does not
  exist is refused with a 400.
- Usage is **derived**, never stored — a variable is used by any row whose `content` contains its
  token, so counts and links can't go stale. Renaming rewrites the token in every body first;
  changing a value rewrites nothing (the token stays put); deleting one still in use is refused
  with the list of SOPs.
- `knowledge_base.content_source` is a **rollback snapshot** of each body as it read before
  placeholders were introduced. The app neither reads nor writes it; drop the column once the
  change has been through staging and production.
- The dashboard substitutes for display only (`Text` in `sop-text.tsx` resolves at the leaf so the
  value can be boxed and named on hover). The SOP list searches the *resolved* text — otherwise
  searching "350,000" would miss the SOP that shows it.
- Variables are managed in a slide-over from the knowledge base sidebar, not a page: each one
  lists the SOPs it appears in as links. In the editor, typing `{` or `/` opens a filtered menu at
  the caret; there is no standing list of names.

## Versions

Every save that changes an editable field of a SOP (title, content, category, come-back flag,
tags) leaves a full snapshot in `ai_agent.knowledge_base_versions`, written by a trigger on
`knowledge_base`. Schema, trigger and backfill live in `db/sop-versions.sql` (untracked).

- **Trigger, not app code, captures the snapshot** so nothing can forget: the editor, the
  variable rename loop and a hand edit in the SQL editor all land in history. Snapshots are
  whole rows, not deltas — a body is ~1.5 KB. The newest **50 per SOP** are kept; the trigger
  deletes older ones. `version_no` never restarts, so a number always means the same content.
- **The trigger can't know who or why** — it only sees the row, and PostgREST gives one
  transaction per request, so there is no side channel. Every SOP write in `mutations.ts` goes
  through `writeSop`: read the latest `version_no`, write, then label versions *newer than that*
  with `change_kind` + `changed_by` (the user's email, passed down from `requireApi`). If nothing
  editable changed, the trigger wrote nothing and nothing is labelled. Labelling is best-effort:
  the save already happened, so a failure is logged, not thrown. A version left with
  `change_kind = null` is an edit the app didn't make.
- **Restore goes through `updateSop`** (`restoreSopVersion`): the body is validated against
  today's variables like any save, and the restore becomes a new version. History is never
  rewritten.
- `content_source` (the pre-variables rollback copy) is backfilled into history as
  `pre_variables`; the column can be dropped once that has run.
- Routes: `GET /api/sops/[id]/versions` (viewer), `POST /api/sops/[id]/restore { version_no }`
  (admin).
- UI: `sop-history.tsx` takes the SOP's place in the main column, like the editor (opened from
  the read view's "History" button; any navigation leaves it). Version list on the left; the
  selected version as a unified line diff (`diff` package) against the previous version or
  against the live row, with title/category/tag changes summarised above.
  The diff is over the authored text, placeholders included: a variable *value* change leaves
  no trace here, by design. Restore is admin-only and hidden when the version equals the live
  row.

## Onboarding topics

The **Onboarding** tab (`/onboarding`) shows and edits `ai_agent.onboarding_content` — the trainer
curriculum the AI teaches new drivers, one row per step.

- Columns: `title, order_index, content text[], final_checks text[], additional_context, urgency,
  platform_id, product_id, mcq_id`. 147 rows: Yango (1) has 137 across 10 `crm.products`
  curricula of 13-14 steps each; Deliveroo (8) has 10 rows with `product_id` null.
- Nav is platform → curriculum (product, or the "All products" bucket for null `product_id`) →
  ordered steps; search spans every curriculum on the platform.
- **Two-stage load, like the SOP tab.** The page seeds only the shell: platforms, product names
  and `listTopicIndexByPlatform` — the nav-only projection (no bodies, ~2 KB vs ~49 KB gzipped).
  The bodies and the MCQs arrive from a background fetch on mount, so first paint costs one round
  trip (~0.35 s of DB time against ~1.2 s for the full seed). A deep link already names its
  platform, so its shell is fetched in parallel with the platform list instead of after it.
  Anything needing a body (the view, the editor, body search) waits on the full corpus and shows
  `OnboardingTopicSkeleton` meanwhile; the index rows are a subset of `OnboardingRow`, so the list
  gains previews when the bodies land without any other change.
- `content` and `final_checks` are `text[]`. `points-editor.tsx` edits them as one auto-growing box
  per point: Enter splits, Backspace at the start merges up, Ctrl+↑/↓ reorders, a multi-line paste
  spreads across points, and the highlighter button wraps the selection in `||…||`. No element may
  contain a newline (none does, verified across the corpus), which is why Enter never inserts one.
  "Edit as plain lines" is the escape hatch — the same two lists as raw textareas. Blank points are
  dropped on save, not while typing. Bodies mark on-screen labels as `||Rider Support Chat||`;
  `splitMarkup` in `src/lib/onboarding/types.ts` turns those into chips in the view.
- `mcq_id` → `comms.mcq` — the quiz that verifies a step. Read-only here: the view renders the
  question, choices and correct answer, and the editor only picks *which* MCQ is linked. The
  picker offers the platform's MCQs plus the platform-less ones (30 of Anda's links are to those).
- **No version history.** Unlike `knowledge_base`, this table has no snapshot trigger, so a save
  or delete is final. Writes are admin-only (`requireApi(true)`); reads need viewer.
- Routes: `GET|POST /api/onboarding`, `PATCH|DELETE /api/onboarding/[id]`, `GET /api/mcq`.

## Monitor (production turns)

The **Monitor** tab (`/monitor`) triages what the deployed agent actually did, from
`comms.ai_turns` — the pipeline's own turn log (~32k rows, +450/day). Read-only: viewer-gated,
no write path, by design. It exists to replace reading n8n failure emails and scrolling Chatwoot.

- **Four failure flags**, each one PostgREST filter; the feed shows the union of the selected ones
  (none selected = all four):

  | Flag | Filter | Volume (2026-08-31) |
  |---|---|---|
  | Escalated | `ai_output->action->>type = 'escalate_to_human'` | 168 |
  | Invalid | `is_valid = false` | 1,357 |
  | Retried | `retry_count > 0` | 1,378 |
  | SOP gap | `sop_agent->>coverage in ('gap','partial')` | 257 |

- **No new SQL.** Two of those address jsonb paths, which only PostgREST's raw filter syntax can
  express; supabase-js passes such fragments through `.or()` untouched (verified live). They live
  as raw strings in `FLAG_FILTER` (`src/lib/turns/queries.ts`) for that reason.
- **No corpus to seed.** Unlike every other tab, the table is far too big to ship to the browser,
  so the page seeds only platforms + the default 1-day window and the feed loads through
  `/api/turns`. Paging is **keyset on `id`**, not offset — the feed is a descending scan and
  offset paging re-walks every skipped row. The feed projection selects jsonb *paths*
  (`action:ai_output->action`), never the whole `ai_output` blob: a page of 50 is ~25 KB rather
  than hundreds. The default 1-day window costs ~430 ms (feed ~410 ms ∥ four counts ~430 ms);
  7 days costs ~600 ms and three months ~5.5 s. `validation_result` IS carried in full
  (+6.6 KB/page) because a row badge names the real error, and only 13% of invalid turns put one
  in `batch_errors` — the other 87% are per-op, under `results[].errors`.
- `ai_turns` has **no platform column** — it comes from `conversations!inner(platform_id)`, which
  is also what scopes the query.
- **Three agent generations share these columns**, so almost every field is optional:
  `reactive_agent_v1` and the legacy `deliveroo_v11` emit `{reply, action, support, topic_writes}`
  with `reply` as objects; `proactive_performance_update_v1` emits `{reply, support,
  decision_trace}` with `reply` as plain strings and **no `action` at all**. `replyTexts` in
  `src/components/monitor-turn.tsx` normalises both shapes. All 32,036 live rows were run through
  the derived helpers without an exception.
- `action.reason` is **written by the model, not an enum** — 15 values live with a long one-off
  tail (`unclear_after_clarification` 107, `clarify_limit_reached` 11, `unsupported_topic` 9, …).
  Never switch on it exhaustively; render it.
- **A badge names the reason, not the category** — "Branch not in SOP", not "SOP gap". Colour
  alone carries the category, and the filter chips above the feed are its legend, so the row never
  spells it out twice. `flagDetails` builds them; `humanizeReason` sentence-cases the snake_case
  code (with an acronym pass, so `branch_not_in_sop` → "Branch not in SOP"). Validation errors run
  to 201 chars, so `shortenError` cuts the badge at the first `;`/`--` and caps it at 64 — 177
  distinct badge labels across the corpus, none longer.
- **A coverage verdict is explained, not just named.** `partial` never carries a `gap_reason`
  (411/411 live rows) and `gap`'s three codes are machine strings, so `gapExplanation` pairs each
  verdict with one sentence saying what it means — on the badge's tooltip and in the "Why flagged"
  block. A gap hands the model nothing (0 of 393 gap turns have a non-empty `bundle_sop_ids`), so
  the block also says what retrieval produced instead: no SOP at all, or N retrieved and rejected,
  with the per-SOP notes left to the SOP-retrieval rail rather than repeated. `sop_agent.queries`
  are `latest:/context:/keywords:` blobs (1,087 of 1,214 on flagged rows; the rest a bare
  sentence) — `parseSopQuery` splits them, and the `context` line is the agent's own reading of
  what the driver needed, i.e. the topic a missing SOP would have to cover. Every flagged row
  yields one (`gapTopic`, 804/804).
- **The headline renders only when it adds something** (`headlineAddsDetail`, 22% of rows): an
  escalation has the model's prose summary and a validation failure has the clause the badge
  truncated, but a gap or a retry would just restate its badge. Suppression is on exact equality,
  so no text is ever lost from the feed.
- **Deep links out are the point.** `action.issue.issue_list_id` → the Issue lists tab;
  `support[]` refs `sop:NN` → Knowledge base and `issue:NN` → Issue lists. `issue_history:NNNN`
  and `issue_detail:NNNN` look linkable but are **`dashboard.issue_logs` ids** (logged instances,
  ids in the thousands), not `issues_list` definitions (max id 278) — `parseSupportRef` gives them
  their own `issue_log` kind so they render as labelled text and don't get "fixed" into a
  mislink.
- **The detail pane is two columns** (stacking below `xl`): the conversation is the narrative and
  takes the main column with the turn's own output above it; everything that *explains* the turn —
  why flagged, SOP retrieval, grounding, decision trace, provenance — sits in a 400px rail beside
  it, scrolling independently.
- The conversation comes from `comms.messages` (20 before the turn, 8 after) and is laid out as a
  chat: driver on the left, everything outbound on the right, day separators, and the turn's own
  message ringed. `agent` is a HUMAN operator and gets the loudest bubble — a human in the thread
  is usually why the turn is worth reviewing. **English only**: `agent_text` is the canonical (a
  translation on inbound rows) and `driver_text` holds the same message in the driver's language,
  which is not shown.
- **Links out to the systems that produced the turn** (`src/lib/turns/links.ts`, both hardcoded —
  one production workspace each, no env): Chatwoot at
  `app.chatwoot.com/app/accounts/125325/conversations/{chatwoot_conversation_id}`, and the n8n run
  at `primary-production-1baf.up.railway.app/workflow/{n8n_workflow_id}/executions/{n8n_workflow_execution_id}`.
  The workflow id comes from the **row**, never from a map keyed on `ai_name`: `deliveroo_v11` ran
  across three workflows (12,683 on `CSLl2DJYtWLoxEpe`, 766 on the reactive agent's
  `psRVRB3SWYm1hy34`, 212 on `keRoJ7hViqE5sekB`), so a name-based map would send ~978 legacy turns
  to the wrong workflow. Live workflows: reactive `psRVRB3SWYm1hy34`, proactive
  `xFPHqJmsWVMxz2KC`. All 32,040 rows carry both ids, so both links resolve on every turn.
- `sop_agent` only exists from **2026-08-27** onward, so the SOP-gap flag is thin and grows. The
  default 1-day window also keeps the retired `deliveroo_v11` turns out of the feed; widen the
  range and they reappear, which is why every row shows its `ai_name`.
- **The period summary is the other half of the tab.** The feed answers "which turns went
  wrong"; `monitor-summary.tsx` answers "how did the AI do over this range", and takes the main
  column whenever no turn is selected (the chart button in the sidebar header and the "Metrics"
  crumb at the top of an open turn both put it back — both are `setTurnId(null)`). It
  is the headline of the `sop-gap-report` skill in `driver-context-manager`, computed live: five
  KPI cards (no relevant SOP found, branch missing, escalated to a human, topics closed by the AI,
  autonomous turned off —
  conversations big, turns and the share of turns they are underneath — the two SOP cards divide by
  the turns the SOP agent checked, the other two by every turn) over the covered/partial/
  gap table and a donut of the turn split, in the Metrics tab's card and table vocabulary
  so the two tabs read as one dashboard. `summarizeTurns` also returns the gap-reason and escalation-reason
  breakdowns, which the panel does not render — they come free with the same scan.
- **The donut is over TURNS, not conversations.** The three verdicts are exclusive per turn, so
  they add to `scored.turns`. Conversation counts do not add up — one conversation can hold a
  covered turn and a gap turn and is counted in both rows — so they stay a table column and are
  never pied. (An earlier version filed each conversation under its worst turn to force a
  partition; that read 57% gap for 1–10 Sep against 13% of turns, because one gap turn painted a
  whole coaching thread. Removed.)
- **Acknowledgement turns are dropped from the whole coverage picture**, not just one card: a gap
  verdict on "thank you" / "ok" / "Block" is a property of the conversation, not a hole in the
  corpus. `isNoAskTurn` (types.ts) is the SOP gap report's test — the driver's last message is ≤4
  words, or the agent's own `context:` line reads as an acknowledgement — run over
  `sop_agent.queries`, which carries both without pulling `context_manager_output`. Only gap turns
  are tested (`scanGapTurns`, a few hundred rows a week); a short message on a covered turn is a
  real ask. `summary.acknowledgements` reports how many were set aside, and the panel says so.
  Live effect, 1–10 Sep: 119 turns out, gap 293 → 174, "no relevant SOP" 234 → 126.
- **Counted in turns AND conversations.** Ten turns in one conversation are one signal, which is
  how the gap report weighs evidence, and PostgREST cannot count distinct — so `summarizeTurns`
  scans the range once on a light projection (jsonb paths only, ~30 KB a day, ~200 KB a week;
  0.6 s and 1.6 s) instead of firing count queries. A conversation can land in several rows, so
  the conversation column doesn't add up — which is why the donut is over turns.
- **"No relevant SOP found" is the agent's own verdict**, not a derived marker: coverage `gap`
  with `gap_reason = retrieved_off_topic`. Its siblings are different findings and are not folded
  in — `branch_not_in_sop` is a SOP that exists and fell short (its own card),
  `action_request_not_procedure` is an ask no procedure covers. The pipeline rewrites a verdict
  whose picks are all low-confidence into exactly this state
  (`coverage_claimed_with_only_low_confidence_sops`), so those land here too. It comes free with
  the scan — no extra query.
- **Topics closed by the AI** = turns carrying a `resolve_topic` op in `ai_output.topic_writes`
  (one `cs` filter). Topics auto-closed for inactivity or staleness are written by a job, not a
  turn, so none of them are counted (0 live) — which is what makes this a proxy for the AI
  actually finishing something rather than a cleanup total. It is per turn, so a turn that closed
  two subjects counts once.
- **Autonomous turned off is inferred, because nothing records the toggle.**
  `comms.conversations` holds only the current `ai_mode` / `is_ai` — no timestamp, no history, no
  message event, and none of the local repos write either column (it is flipped from the
  Chatwoot/n8n side). But every turn, reactive and proactive, stamps the mode it ran in
  (`ai_turns.ai_mode`, 0 mismatches against the conversation on recent reactive turns), so a
  `suggest` turn straight after an `autonomous` one in the same conversation is a switch.
  Consequences: it is a **lower bound** (a switch followed by no further turn never shows), the
  moment is only known to fall between two turns, and there is no actor. The first in-range turn
  needs its predecessor's mode, so `modesBefore` seeds from a 7-day lookback — consecutive turns
  are ≤3 days apart 99% of the time, and 7 days gave the same September count as all of August.
  `is_ai` is deliberately ignored: reactive turns keep running on conversations marked
  `is_ai = false` (36 in the three days to 11 Sep), so it is not what stops the AI. Since 1 Aug on
  Anda: 27 switches off in 23 conversations, 90 back on. An exact count (with who) needs the n8n
  workflow that writes `ai_mode` to log each change into a new events table; until then this is it.
- Escalations are reported twice on purpose: `action.type = escalate_to_human` (a person was
  pulled in) and `sop_agent.escalate` (the SOP agent asked for one). The counts differ.
- The summary ignores the flag chips — they narrow the feed, not the period — so it is its own
  request with its own loading flag, refetched only when platform, dates or refresh move.
- Routes: `GET /api/turns` (feed + counts; counts on the first page only), `GET /api/turns/[id]`,
  `GET /api/turns/summary` (the period summary; viewer).

## Conventions

- Keep secrets server-side (above). This is the one rule that must not bend.
- Bigint PKs come back as strings from PostgREST — types model them, don't assume `number` at
  the wire.
- Don't add auth / write paths / extra deps unless asked — scaffold is intentionally minimal.
- Real dashboard UI is pending the user's design; `src/app/page.tsx` is a placeholder table.
