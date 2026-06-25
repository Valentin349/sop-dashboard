import { NextResponse } from "next/server";

import { listSopsByPlatform } from "@/lib/sops/queries";
import { createSop } from "@/lib/sops/mutations";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// ?platform=<id> → every SOP on the platform. This is the single corpus the dashboard caches;
// category views and search both derive from it client-side.
export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const sops = await listSopsByPlatform(platform);
  return NextResponse.json({ sops });
}

export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  const platform_id = Number(body?.platform_id);
  const category_id = Number(body?.category_id);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";

  if (!Number.isInteger(platform_id) || !Number.isInteger(category_id) || !title) {
    return NextResponse.json(
      { error: "platform_id, category_id and title are required" },
      { status: 400 },
    );
  }

  try {
    const sop = await createSop({
      platform_id,
      category_id,
      title,
      content,
      is_come_back: Boolean(body?.is_come_back),
      data_source: typeof body?.data_source === "string" ? body.data_source : undefined,
      product_tags: Array.isArray(body?.product_tags)
        ? body.product_tags.map(Number).filter(Number.isInteger)
        : [],
      vehicle_tags: Array.isArray(body?.vehicle_tags)
        ? body.vehicle_tags.filter((v: unknown) => typeof v === "string")
        : [],
      driver_status_tags: Array.isArray(body?.driver_status_tags)
        ? body.driver_status_tags.filter((v: unknown) => typeof v === "string")
        : [],
    });
    return NextResponse.json({ sop }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
