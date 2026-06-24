"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldAlert } from "lucide-react";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-sm"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">SOP Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">Sign in to continue.</p>
      </div>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {state.error}
        </p>
      )}

      <div className="space-y-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          autoFocus
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}

// Shown when someone is signed in but has no role assigned (not on the allowlist).
export function NoAccessCard({ email }: { email: string }) {
  const router = useRouter();
  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.refresh();
  }
  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
      <ShieldAlert className="mx-auto size-7 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="text-sm text-muted-foreground">
          {email} isn&apos;t authorized for this dashboard. Ask an admin to grant you a role.
        </p>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="rounded-md border px-3 py-1.5 text-[13px] transition-colors hover:bg-accent"
      >
        Sign out
      </button>
    </div>
  );
}
