import { NextResponse } from "next/server";

import { deleteVariable, updateVariable } from "@/lib/sops/mutations";
import { isValidVariableName } from "@/lib/sops/variables";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function parseId(params: { id: string }): number | null {
  const id = Number(params.id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch: { name?: string; value?: string; description?: string | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().toUpperCase();
    if (!isValidVariableName(name)) {
      return NextResponse.json(
        { error: "A name uses capitals, digits and underscores, and starts with a letter." },
        { status: 400 },
      );
    }
    patch.name = name;
  }
  if (typeof body.value === "string") {
    if (!body.value.trim()) {
      return NextResponse.json({ error: "Give the variable a value." }, { status: 400 });
    }
    patch.value = body.value;
  }
  if (typeof body.description === "string") patch.description = body.description.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields" }, { status: 400 });
  }

  try {
    const { variable, rewritten } = await updateVariable(id, patch);
    return NextResponse.json({ variable, rewritten });
  } catch (e) {
    const message = String((e as Error).message);
    const conflict = message.includes("sop_variables_platform_name_key");
    return NextResponse.json(
      { error: conflict ? "That name is already taken on this platform." : message },
      { status: conflict ? 409 : 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await deleteVariable(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // "still used by N SOPs" is a refusal the writer must act on, not a server fault.
    return NextResponse.json({ error: String((e as Error).message) }, { status: 409 });
  }
}
