import { NextResponse } from "next/server";

import { listSopRefsByIds } from "@/lib/issues/queries";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// ?ids=1,2,3 → resolve sop_ids_to_exhaust to { id, title, platform_id } from
// ai_agent.knowledge_base, so the issue detail view can render deep-links into the SOP tab.
export async function GET(req: Request) {
  const g = await requireApi();
  if (g.error) return g.error;

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Number.isInteger);

  const refs = await listSopRefsByIds(ids);
  return NextResponse.json({ refs });
}
