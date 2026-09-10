import { NextResponse } from "next/server";

import { requireApi } from "@/lib/auth/session";
import { summarizeTurns } from "@/lib/turns/queries";
import { parseDate } from "@/lib/turns/nav";

export const dynamic = "force-dynamic";

// GET /api/turns/summary?platform=1&from=2026-09-01&to=2026-09-08
//
// How the AI did over the range: SOP coverage, escalations, missing SOPs, topics closed.
// Read-only and viewer-gated like the feed. Deliberately takes no `flags` — the chips narrow the
// feed, and a summary of the selected flags would just restate them.
//
// It costs a scan of the range (one light row per turn, 1000 to a page: ~0.3 s a day, ~0.9 s a
// week), so it is fetched beside the feed rather than inside it.
export async function GET(req: Request) {
  const g = await requireApi();
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;

  const platformId = Number(sp.get("platform"));
  if (!Number.isInteger(platformId)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }

  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"));
  if (!from || !to) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    return NextResponse.json(await summarizeTurns({ platformId, from, to }));
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
