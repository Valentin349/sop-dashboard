import { NextResponse } from "next/server";

import { listSopMedia } from "@/lib/sops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sop = Number(new URL(req.url).searchParams.get("sop"));
  if (!Number.isInteger(sop)) {
    return NextResponse.json({ error: "invalid sop" }, { status: 400 });
  }
  const media = await listSopMedia(sop);
  return NextResponse.json({ media });
}
