@AGENTS.md

# sop-dashboard

Internal dashboard to **show and manage SOPs** in Supabase `ai_agent.knowledge_base` — the
RAG source consumed by the `driver-context-manager` service (`comms.topic_sops.sop_id` →
`ai_agent.knowledge_base.id`). Scaffold stage; the real UI is TBD.

## Stack

Next.js 16 (App Router) + TypeScript · Tailwind v4 + shadcn/ui · `@supabase/supabase-js`.
npm. Node 24. No auth yet.

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

## Conventions

- Keep secrets server-side (above). This is the one rule that must not bend.
- Bigint PKs come back as strings from PostgREST — types model them, don't assume `number` at
  the wire.
- Don't add auth / write paths / extra deps unless asked — scaffold is intentionally minimal.
- Real dashboard UI is pending the user's design; `src/app/page.tsx` is a placeholder table.
