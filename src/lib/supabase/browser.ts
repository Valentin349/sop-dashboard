import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — used ONLY for auth (login/logout/session). The anon key is the
// public key; data never goes through this client (that stays on the server service-role).
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
