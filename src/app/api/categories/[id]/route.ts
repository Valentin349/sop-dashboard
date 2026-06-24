import { NextResponse } from "next/server";

import { deleteCategory, updateCategory } from "@/lib/sops/mutations";

export const dynamic = "force-dynamic";

function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const patch: { name?: string; description?: string | null } = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields" }, { status: 400 });
  }

  try {
    const category = await updateCategory(id, patch);
    return NextResponse.json({ category });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Empty-guard violation surfaces here as a 409 (conflict), not a server fault.
    return NextResponse.json({ error: String((e as Error).message) }, { status: 409 });
  }
}
