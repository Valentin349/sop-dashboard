import { NextResponse } from "next/server";

import { listSopVersions } from "@/lib/sops/queries";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Every kept version of one SOP, newest first.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApi();
  if (g.error) return g.error;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    return NextResponse.json({ versions: await listSopVersions(id) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
