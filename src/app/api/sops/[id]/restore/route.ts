import { NextResponse } from "next/server";

import { restoreSopVersion } from "@/lib/sops/mutations";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// { version_no } → the SOP's editable fields as they were in that version, saved as a new
// version. History is never rewritten.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const versionNo = Number(body?.version_no);
  if (!Number.isInteger(versionNo) || versionNo < 1) {
    return NextResponse.json({ error: "version_no is required" }, { status: 400 });
  }

  try {
    const sop = await restoreSopVersion(id, versionNo, g.user.email);
    return NextResponse.json({ sop });
  } catch (e) {
    const message = String((e as Error).message);
    // Things the writer can act on, not server faults.
    if (message.includes("no longer exists")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("No variable named")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("category_id")) {
      return NextResponse.json(
        { error: "That version's category has since been deleted. Move the SOP first." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
