import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS — must never be imported into a Client Component.
// The `server-only` import above makes such a bundle fail at build time.

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy them into .env.local (see .env.example).",
  );
}

// Schema-typed as `ai_agent`; the explicit return type is inferred (not the public default).
let client: ReturnType<typeof createSchemaClient> | undefined;

function createSchemaClient() {
  return createClient(url!, serviceRoleKey!, {
    db: { schema: "ai_agent" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// SOPs live in the `ai_agent` schema; the platforms lookup lives in `public`.
// Default this client to `ai_agent`; callers that need `public` use `.schema("public")`.
export function getServerClient() {
  if (!client) {
    client = createSchemaClient();
  }
  return client;
}
