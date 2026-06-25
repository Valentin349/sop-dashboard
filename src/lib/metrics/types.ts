// Response shapes of the Engagement Metrics API
// (https://engagementmetrics-production.up.railway.app), verified against live responses.
// Every endpoint returns { status, duration_seconds, metric, ... }; the metric-specific fields
// follow. Counts are plain numbers here (not bigint strings) — the API serializes them as JSON
// numbers, unlike PostgREST.

export interface MetricPeriod {
  start: string;
  end: string;
}

// ── M: avg-time-to-respond ────────────────────────────────────────────────────
export interface AvgTimeSenderBreakdown {
  // "Overall" | "agent" | "ai" | "performance_trigger" | "system"
  sender_type: string;
  total_responded: number;
  median_response_minutes: number;
  mean_response_minutes: number;
  min_response_minutes: number;
  max_response_minutes: number;
}

export interface AvgTimeAgentPlatform {
  agent_id: number | null;
  agent_name: string | null;
  platform_id: number | null;
  platform_name: string | null;
  breakdown: AvgTimeSenderBreakdown[];
}

export interface AvgTimeToRespond {
  status: string;
  duration_seconds: number;
  metric: string;
  period: MetricPeriod;
  platform_ids: number[] | null;
  platform_ids_in_result: number[];
  total_responded: number;
  median_response_minutes: number;
  mean_response_minutes: number;
  min_response_minutes: number;
  max_response_minutes: number;
  kpi_target_minutes: number;
  meets_kpi: boolean;
  per_agent_platform: AvgTimeAgentPlatform[];
}

// ── M1: response-rate ─────────────────────────────────────────────────────────
export interface ResponseRateAgentPlatform {
  agent_id: number | null;
  agent_name: string | null;
  platform_id: number | null;
  platform_name: string | null;
  total_coached_drivers: number;
  total_engaged_drivers: number;
  rate_pct: number;
}

export interface ResponseRate {
  status: string;
  duration_seconds: number;
  metric: string;
  period: MetricPeriod;
  params: {
    response_window_hours: number;
    min_occasions: number;
    platform_ids: number[] | null;
  };
  platform_ids_in_result: number[];
  total_coached_drivers: number;
  total_engaged_drivers: number;
  rate_pct: number;
  kpi_target_pct: number;
  meets_kpi: boolean;
  per_agent_platform: ResponseRateAgentPlatform[];
}

// ── M2: sustained-engagement ──────────────────────────────────────────────────
export interface SustainedEngagementAgentPlatform {
  agent_id: number | null;
  agent_name: string | null;
  platform_id: number | null;
  platform_name: string | null;
  total_engaged_drivers: number;
  total_sustained_drivers: number;
  rate_pct: number;
}

export interface SustainedEngagement {
  status: string;
  duration_seconds: number;
  metric: string;
  period: MetricPeriod;
  params: {
    min_occasions: number;
    response_window_hours: number;
    platform_ids: number[] | null;
  };
  platform_ids_in_result: number[];
  total_engaged_drivers: number;
  total_sustained_drivers: number;
  rate_pct: number;
  kpi_target_pct: number;
  meets_kpi: boolean;
  per_agent_platform: SustainedEngagementAgentPlatform[];
}

// ── M3: outreach-response-rate (lifetime, no params) ──────────────────────────
export interface OutreachResponseRate {
  status: string;
  duration_seconds: number;
  metric: string;
  total_outreached: number;
  total_with_conversation: number;
  total_without_conversation: number;
  rate_pct: number;
  kpi_target_pct: number;
  meets_kpi: boolean;
}

// ── M4: ai-acceptance-rate (lifetime; platform_id optional) ───────────────────
export interface AiAcceptanceAgentPlatform {
  agent_id: number | null;
  agent_name: string | null;
  platform_id: number | null;
  platform_name: string | null;
  conversations: number;
  suggests: number;
  accepts: number;
  rejects: number;
  ignored: number;
  acceptance_rate_pct: number;
}

export interface AiAcceptanceRate {
  status: string;
  duration_seconds: number;
  metric: string;
  total_conversations: number;
  total_suggests: number;
  total_accepts: number;
  total_rejects: number;
  total_ignored: number;
  acceptance_rate_pct: number;
  per_agent_platform: AiAcceptanceAgentPlatform[];
}

// ── M5: median-outreach (lifetime, no params) ─────────────────────────────────
export interface MedianOutreach {
  status: string;
  duration_seconds: number;
  metric: string;
  total_drivers: number;
  median_outreach_count: number;
  mean_outreach_count: number;
  min_outreach_count: number;
  max_outreach_count: number;
  kpi_target: number;
  meets_kpi: boolean;
}

// The metric ids the proxy route accepts, in display order. Mirrors METRIC_PATHS in api.ts.
export const METRIC_IDS = [
  "response-rate",
  "sustained-engagement",
  "avg-time-to-respond",
  "outreach-response-rate",
  "ai-acceptance-rate",
  "median-outreach",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

// Map each metric id to its response type, so the client can type the bundle it loads.
export interface MetricResponses {
  "response-rate": ResponseRate;
  "sustained-engagement": SustainedEngagement;
  "avg-time-to-respond": AvgTimeToRespond;
  "outreach-response-rate": OutreachResponseRate;
  "ai-acceptance-rate": AiAcceptanceRate;
  "median-outreach": MedianOutreach;
}
