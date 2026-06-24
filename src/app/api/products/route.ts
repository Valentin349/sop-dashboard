import { NextResponse } from "next/server";

import { listProducts } from "@/lib/sops/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const products = await listProducts(platform);
  return NextResponse.json({ products });
}
