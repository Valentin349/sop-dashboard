import { NextResponse } from "next/server";

import { listCategoriesByPlatform } from "@/lib/sops/queries";
import { createCategory } from "@/lib/sops/mutations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const categories = await listCategoriesByPlatform(platform);
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const platform_id = Number(body?.platform_id);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(platform_id) || !name) {
    return NextResponse.json(
      { error: "platform_id and name are required" },
      { status: 400 },
    );
  }
  try {
    const category = await createCategory({
      platform_id,
      name,
      description:
        typeof body?.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
