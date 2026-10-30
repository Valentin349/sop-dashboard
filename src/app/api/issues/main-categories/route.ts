import { NextResponse } from "next/server";

import { listIssueEnums } from "@/lib/issues/queries";
import { addMainCategory } from "@/lib/issues/mutations";
import { MAIN_CATEGORY_PATTERN } from "@/lib/issues/types";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Make sure a main category exists in the enum `dashboard.main_category`, adding it if needed.
// Admin only — it is DDL on a column other services read. Returns the canonical label: a name
// that already exists (in any casing) is reused rather than duplicated, so the call is safe to
// repeat and the editor can send whatever the user typed.
export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!MAIN_CATEGORY_PATTERN.test(name)) {
    return NextResponse.json(
      {
        error:
          "A main category is letters, digits and underscores, starting with a letter (e.g. fuel_card).",
      },
      { status: 400 },
    );
  }

  try {
    const { mainCategories } = await listIssueEnums();
    const existing = mainCategories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) return NextResponse.json({ name: existing, created: false });
    await addMainCategory(name);
    return NextResponse.json({ name, created: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
