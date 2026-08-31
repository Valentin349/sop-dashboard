import { redirect } from "next/navigation";

import { listPlatforms, listProducts } from "@/lib/sops/queries";
import { listTopicIndexByPlatform } from "@/lib/onboarding/queries";
import { getCurrentUser, hasAccess } from "@/lib/auth/session";
import { OnboardingDashboard } from "@/components/onboarding-dashboard";

export const dynamic = "force-dynamic";

function toId(v: string | string[] | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasAccess(user.role)) redirect("/login");
  const role = user.role ?? "viewer";

  const params = await searchParams;

  // Seed only the shell — platforms, product names and the nav-only topic index (~2 KB). The
  // bodies and the MCQs are fetched client-side after paint (see the dashboard's mount effect),
  // so first paint costs one round trip instead of waiting on the whole corpus.
  //
  // A deep link already names its platform, so its shell data is fetched in parallel with the
  // platform list rather than after it; only the bare /onboarding case has to wait for the ids.
  const linkedPlatform = toId(params.platform);
  const [platforms, linkedShell] = await Promise.all([
    listPlatforms(),
    linkedPlatform
      ? Promise.all([listTopicIndexByPlatform(linkedPlatform), listProducts(linkedPlatform)])
      : Promise.resolve(null),
  ]);

  const platformId = linkedPlatform ?? platforms[0]?.id ?? null;
  const [initialIndex, initialProducts] =
    linkedShell ??
    (platformId
      ? await Promise.all([listTopicIndexByPlatform(platformId), listProducts(platformId)])
      : [[], []]);

  return (
    <OnboardingDashboard
      platforms={platforms}
      initialPlatformId={platformId}
      initialProductKey={typeof params.product === "string" ? params.product : null}
      initialTopicId={toId(params.topic)}
      initialIndex={initialIndex}
      initialProducts={initialProducts}
      role={role}
    />
  );
}
