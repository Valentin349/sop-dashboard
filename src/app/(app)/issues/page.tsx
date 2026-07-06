import { redirect } from "next/navigation";

import { listPlatforms } from "@/lib/sops/queries";
import { listIssuesByPlatform } from "@/lib/issues/queries";
import { getCurrentUser, hasAccess } from "@/lib/auth/session";
import { IssuesDashboard } from "@/components/issues-dashboard";

export const dynamic = "force-dynamic";

function toId(v: string | string[] | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasAccess(user.role)) redirect("/login");
  const role = user.role ?? "viewer";

  const params = await searchParams;

  const platforms = await listPlatforms();
  const platformId = toId(params.platform) ?? platforms[0]?.id ?? null;

  // The corpus is small (≤~75 rows/platform) and the tree derives from it, so seed the whole
  // platform's issues server-side — it paints instantly and needs no background fetch.
  const initialIssues = platformId ? await listIssuesByPlatform(platformId) : [];

  return (
    <IssuesDashboard
      platforms={platforms}
      initialPlatformId={platformId}
      initialIssueId={toId(params.issue)}
      initialIssues={initialIssues}
      role={role}
    />
  );
}
