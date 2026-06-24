import "server-only";

import { NextResponse } from "next/server";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

export type Role = "viewer" | "admin";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: Role | null;
}

// Access requires a role set in the user's app_metadata (admin-only field). A signed-in user
// with no role has NO access — roles are the allowlist. Set them with one SQL update:
//   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
//   where email = '...';
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = (user.app_metadata?.role as Role | undefined) ?? null;
  return { id: user.id, email: user.email ?? null, role };
}

export function hasAccess(role: Role | null): boolean {
  return role === "viewer" || role === "admin";
}

// Guard for API route handlers. Returns the user, or an error response to return as-is.
export async function requireApi(
  admin = false,
): Promise<
  { user: CurrentUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user || !hasAccess(user.role)) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  }
  if (admin && user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { user };
}
