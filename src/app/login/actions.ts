"use server";

import { redirect } from "next/navigation";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

export interface LoginState {
  error: string | null;
}

// Server-side sign-in: cookies are written on the response before the redirect, so the very
// next request (middleware) sees the session — no client-side race, no full reload.
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password required" };

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}
