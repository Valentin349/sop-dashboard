import { redirect } from "next/navigation";

import { getCurrentUser, hasAccess } from "@/lib/auth/session";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

// Shared chrome for the authenticated app (Knowledge base + Metrics). The TopBar lives here, so it
// renders ONCE and stays mounted across tab switches — only the page content below (and the search
// bar the SOP page portals into the bar) changes on navigation.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !hasAccess(user.role)) redirect("/login");

  return (
    <div className="flex h-screen flex-col overflow-hidden text-foreground">
      <TopBar username={user.email ?? "Account"} role={user.role ?? "viewer"} />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
