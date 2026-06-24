import { redirect } from "next/navigation";

import {
  listCategoriesByPlatform,
  listPlatforms,
  listProducts,
  listSopsByCategory,
} from "@/lib/sops/queries";
import { getCurrentUser, hasAccess } from "@/lib/auth/session";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

function toId(v: string | string[] | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export default async function Home({
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
  const categoryId = toId(params.category);

  // Seed the initial view server-side so a deep link paints without a client fetch.
  // Everything after first load (category/SOP/platform switching) is client-driven + cached.
  const [initialCategories, initialSops, initialProducts] = await Promise.all([
    platformId ? listCategoriesByPlatform(platformId) : Promise.resolve([]),
    categoryId ? listSopsByCategory(categoryId) : Promise.resolve([]),
    platformId ? listProducts(platformId) : Promise.resolve([]),
  ]);

  return (
    <Dashboard
      platforms={platforms}
      initialPlatformId={platformId}
      initialCategoryId={categoryId}
      initialSopId={toId(params.sop)}
      initialCategories={initialCategories}
      initialSops={initialSops}
      initialProducts={initialProducts}
      role={role}
      username={user.email ?? "Account"}
    />
  );
}
