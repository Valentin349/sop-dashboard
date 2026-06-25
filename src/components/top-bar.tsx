"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import type { Role } from "@/lib/auth/session";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { NavTabs } from "./nav-tabs";

// DOM id of the center slot. The SOP dashboard portals its search bar into this node, so the bar
// is conditionally present WITHOUT re-rendering the TopBar itself (which lives in the layout and
// stays mounted across tab switches).
export const TOPBAR_CENTER_ID = "app-topbar-center";

// Shared application top bar: brand + Knowledge base/Metrics switcher on the left, a center slot
// (portal target) in the middle, and account + sign-out on the right. Rendered once by the app
// layout so the nav and account controls never move or re-render when switching tabs.
export function TopBar({ username, role }: { username: string; role: Role }) {
  const router = useRouter();

  async function logout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex shrink-0 items-center gap-4 border-b px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-3">
        <p className="pr-1 text-sm font-semibold tracking-tight">SOP Dashboard</p>
        <NavTabs />
      </div>
      <div id={TOPBAR_CENTER_ID} className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="truncate text-[12px] font-medium">{username}</p>
          <p className="text-[11px] capitalize text-muted-foreground">{role}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
