import { NextResponse } from "next/server";

import { requireApi } from "@/lib/auth/session";
import { getTurnDetail } from "@/lib/turns/queries";

export const dynamic = "force-dynamic";

// GET /api/turns/:id → the full turn (ai_output, validation_result, sop_agent) plus the
// surrounding conversation. Viewer-gated; there is no write counterpart by design.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await requireApi();
  if (g.error) return g.error;

  const { id } = await params;
  const turnId = Number(id);
  if (!Number.isInteger(turnId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const detail = await getTurnDetail(turnId);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
