import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Role } from "@/lib/auth/session";

// Single authentication gate + Supabase session refresh. Pages → redirect to /login when not
// authorized; API → 401 JSON. "Authorized" = a signed-in user with a role (viewer or admin);
// per-route handlers still enforce admin for writes.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as Role | undefined;
  const authorized = role === "viewer" || role === "admin";

  if (authorized) return res;

  if (req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
