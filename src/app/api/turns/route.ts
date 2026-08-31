import { NextResponse } from "next/server";

import { requireApi } from "@/lib/auth/session";
import { countFlags, listFlaggedTurns } from "@/lib/turns/queries";
import { parseDate, parseFlags } from "@/lib/turns/nav";

export const dynamic = "force-dynamic";

// GET /api/turns?platform=1&from=2026-08-24&to=2026-08-31&flags=escalated,invalid&cursor=32000
//
// One page of flagged turns, newest first, plus the per-flag counts for the range. Read-only and
// viewer-gated: the Monitor tab never writes to the pipeline's log.
//
// Counts are returned only on the FIRST page — they cost four extra count-only queries (~1.6s
// together) and can't change as you scroll deeper into the same range.
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

  const rawCursor = sp.get("cursor");
  const cursor = rawCursor == null ? null : Number(rawCursor);
  if (cursor != null && !Number.isInteger(cursor)) {
    return NextResponse.json({ error: "invalid cursor" }, { status: 400 });
  }

  const query = { platformId, from, to, flags: parseFlags(sp.get("flags")) };

  try {
    const [page, counts] = await Promise.all([
      listFlaggedTurns(query, cursor),
      cursor == null ? countFlags(query) : Promise.resolve(null),
    ]);
    return NextResponse.json({ ...page, counts });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
