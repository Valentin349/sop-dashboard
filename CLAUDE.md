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

## Conventions

- Keep secrets server-side (above). This is the one rule that must not bend.
- Bigint PKs come back as strings from PostgREST — types model them, don't assume `number` at
  the wire.
- Don't add auth / write paths / extra deps unless asked — scaffold is intentionally minimal.
- Real dashboard UI is pending the user's design; `src/app/page.tsx` is a placeholder table.
