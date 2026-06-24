# sop-dashboard

Internal dashboard to show and manage SOPs stored in Supabase `ai_agent.knowledge_base`
(the RAG source consumed by `driver-context-manager`).

> Scaffold stage. The real UI is TBD — `src/app/page.tsx` is a placeholder SOP table.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- Supabase (`@supabase/supabase-js`), **service-role key, server-side only**

## Data access

The `ai_agent` schema is not exposed to the Supabase `anon` role (`permission denied for
schema ai_agent`), so all DB access uses the **service-role** key. It is read in
`src/lib/supabase/server.ts`, guarded by `import "server-only"` — importing the client into a
Client Component fails the build, so the key can never reach the browser. No `NEXT_PUBLIC_`
prefix.

Queries live in `src/lib/sops/queries.ts` (range-paginated reads mirroring
`driver-context-manager/data/database_read.py`). Types in `src/lib/sops/types.ts`.

## Setup

```bash
cp .env.example .env.local
# Fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (copy from driver-context-manager/.env)
npm install
npm run dev   # http://localhost:3000
```

## Tables used

- `ai_agent.knowledge_base` — the SOPs (~879 rows).
- `ai_agent.knowledge_base_categories` — category names.
- `public.platforms` — platform names (1 Yango, 8 Deliveroo, 12 Bolt).
