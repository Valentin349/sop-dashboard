import { NextResponse } from "next/server";

import { deleteSop, updateSop, type SopPatch } from "@/lib/sops/mutations";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: SopPatch = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.content === "string") patch.content = body.content;
  if (Number.isInteger(body.category_id)) patch.category_id = body.category_id;
  if (typeof body.is_come_back === "boolean") patch.is_come_back = body.is_come_back;
  if (typeof body.data_source === "string") patch.data_source = body.data_source;
  if (Array.isArray(body.product_tags))
    patch.product_tags = body.product_tags.map(Number).filter(Number.isInteger);
  if (Array.isArray(body.vehicle_tags))
    patch.vehicle_tags = body.vehicle_tags.filter((v: unknown) => typeof v === "string");
  if (Array.isArray(body.driver_status_tags))
    patch.driver_status_tags = body.driver_status_tags.filter(
      (v: unknown) => typeof v === "string",
    );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields" }, { status: 400 });
  }

  try {
    const sop = await updateSop(id, patch);
    return NextResponse.json({ sop });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await deleteSop(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
