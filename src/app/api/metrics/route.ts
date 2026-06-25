import { NextResponse } from "next/server";

import { requireApi } from "@/lib/auth/session";
import { fetchMetric, isMetricId } from "@/lib/metrics/api";

export const dynamic = "force-dynamic";

// Upstream query params we're willing to forward. Anything else (including our own `metric`
// router field) is dropped, so the client can't smuggle arbitrary query into the metrics API.
const FORWARD_PARAMS = new Set([
  "start_date",
  "end_date",
  "response_window_hours",
  "min_occasions",
  "platform_id",
]);

// Proxy: GET /api/metrics?metric=<id>&start_date=…&platform_id=…
// Auth is enforced here (viewer or admin); the user's Supabase token is forwarded in fetchMetric.
export async function GET(req: Request) {
  const g = await requireApi();
  if (g.error) return g.error;

  const url = new URL(req.url);
  const metric = url.searchParams.get("metric");
  if (!metric || !isMetricId(metric)) {
    return NextResponse.json({ error: "unknown metric" }, { status: 400 });
  }

  // platform_id may repeat (the API takes an array), so use append, not set.
  const forward = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (FORWARD_PARAMS.has(key)) forward.append(key, value);
  }

  const result = await fetchMetric(metric, forward);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
