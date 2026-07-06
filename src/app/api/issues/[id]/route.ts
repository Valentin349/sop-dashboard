import { NextResponse } from "next/server";

import { deleteIssue, updateIssue } from "@/lib/issues/mutations";
import { requireApi } from "@/lib/auth/session";
import { parseIssueFields } from "../route";

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

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const patch = parseIssueFields(body, true);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields" }, { status: 400 });
  }

  try {
    const issue = await updateIssue(id, patch);
    return NextResponse.json({ issue });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = parseId(await ctx.params);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    await deleteIssue(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
