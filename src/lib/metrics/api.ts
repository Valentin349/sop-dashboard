import "server-only";

import { createAuthServerClient } from "@/lib/supabase/auth-server";
import type { MetricId } from "./types";

// The Engagement Metrics API authenticates with the SIGNED-IN USER's Supabase access token as a
// Bearer credential — the same session this app already holds in cookies. So all calls go
// server-side (this file), forwarding that token; the browser never sees it and there's no CORS
// to negotiate. The base URL is overridable via env, defaulting to production.
const BASE_URL =
  process.env.METRICS_API_BASE_URL ??
  "https://engagementmetrics-production.up.railway.app";

// Metric id → API path. The keys are the only values the proxy route will route.
export const METRIC_PATHS: Record<MetricId, string> = {
  "response-rate": "/metrics/response-rate/",
  "sustained-engagement": "/metrics/sustained-engagement/",
  "avg-time-to-respond": "/metrics/avg-time-to-respond/",
  "outreach-response-rate": "/metrics/outreach-response-rate/",
  "ai-acceptance-rate": "/metrics/ai-acceptance-rate/",
  "median-outreach": "/metrics/median-outreach/",
};

export function isMetricId(v: string): v is MetricId {
  return Object.prototype.hasOwnProperty.call(METRIC_PATHS, v);
}

export type MetricFetch =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

// Forward a GET to the metrics API with the current user's access token. `search` holds only the
// upstream query params (start_date, platform_id, …) — never our own routing fields.
export async function fetchMetric(
  name: MetricId,
  search: URLSearchParams,
): Promise<MetricFetch> {
  const supabase = await createAuthServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, status: 401, error: "No active session" };

  const qs = search.toString();
  const url = `${BASE_URL}${METRIC_PATHS[name]}${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: `Upstream unreachable: ${(e as Error).message}` };
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : text.slice(0, 300);
    return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
  }
  return { ok: true, data };
}
