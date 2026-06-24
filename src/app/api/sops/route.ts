import { NextResponse } from "next/server";

import { listSopsByCategory } from "@/lib/sops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const category = Number(new URL(req.url).searchParams.get("category"));
  if (!Number.isInteger(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }
  const sops = await listSopsByCategory(category);
  return NextResponse.json({ sops });
}
