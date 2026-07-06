// Shapes mirror the live Supabase columns of dashboard.issues_list (verified against the DB).
// Numeric-looking PKs come back as strings from PostgREST for bigint columns, but we type the
// ones we read/write as numbers and coerce at the wire (route handlers) where it matters.

// Postgres enum `dashboard.main_category` — the full domain, needed for the create/edit select.
export const MAIN_CATEGORIES = [
  "bike_breakdown",
  "bike_accident",
  "blocked_bike",
  "smartphone",
  "family_emergency",
  "payment_issue",
  "anda",
  "yango",
  "disengaged",
  "expired_documentation",
  "bike_confiscated",
  "illness",
  "police",
  "on_order_bike_accident",
  "off_order_bike_accident",
  "vendor",
  "careem",
  "product",
  "shift_calendar",
  "theft",
  "unable_to_work",
  "vacation",
  "hours_online",
  "trips",
  "inactive",
  "anda_kamba",
  "anda_piloto",
  "agency",
  "deliveroo",
  "emergency",
  "motorbike",
  "motorbike_accident_on_duty",
  "motorbike_accident_off_duty",
  "motorbike_confiscation",
  "shift_schedule",
  "car_breakdown",
  "blocked_car",
  "car_confiscated",
  "car_accident",
  "churn",
  "new",
  "EMA",
  "net_earnings",
  "bolt",
  "payments",
  "active",
  "suspended",
] as const;
export type MainCategory = (typeof MAIN_CATEGORIES)[number];

// Postgres enum `dashboard.issue_type`.
export const ISSUE_TYPES = ["support", "performance", "training"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

// Postgres enum `dashboard.vehicle_type` (the column is nullable).
export const VEHICLE_TYPES = ["bike", "car"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface IssueRow {
  id: number;
  created_at: string;
  main_category: MainCategory | null;
  sub_category: string | null;
  sub_sub_category: string | null;
  severity: string | null;
  name: string | null;
  definition: string | null;
  chatwoot_canned_id: number | null;
  platform_id: number | null;
  issue_type: IssueType | null;
  questions_before_log: string | null;
  questions_after_log: string | null;
  prelog_mandatory_info: string | null;
  prelog_optional_instructions: string | null;
  // References ai_agent.knowledge_base.id — resolved to titles for the detail view chips.
  sop_ids_to_exhaust: number[];
  postlog_instructions: string | null;
  always_log: boolean | null;
  vehicle_type: VehicleType | null;
  expiration_days: number | null;
  // SOP-style multi-select tags (empty array = applies to all). product_tags holds crm.products
  // ids; the other two hold fixed enum strings — same vocabularies as knowledge_base (see
  // src/lib/sops/tags.ts).
  product_tags: number[];
  vehicle_tags: string[];
  driver_status_tags: string[];
}

// A SOP referenced by sop_ids_to_exhaust, resolved from ai_agent.knowledge_base so the issue
// detail view can render a clickable chip that deep-links into the Knowledge base tab.
export interface SopRef {
  id: number;
  title: string | null;
  platform_id: number | null;
}
