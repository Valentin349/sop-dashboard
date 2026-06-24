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

## Conventions

- Keep secrets server-side (above). This is the one rule that must not bend.
- Bigint PKs come back as strings from PostgREST — types model them, don't assume `number` at
  the wire.
- Don't add auth / write paths / extra deps unless asked — scaffold is intentionally minimal.
- Real dashboard UI is pending the user's design; `src/app/page.tsx` is a placeholder table.
