import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client bound to the request cookies — reads/refreshes the user's auth
// session. Auth only; data access still uses the service-role client in ./server.ts.
export async function createAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components cookies are read-only; the middleware refresh handles writes.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
