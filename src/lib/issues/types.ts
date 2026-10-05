// Shapes mirror the live Supabase columns of dashboard.issues_list (verified against the DB).
// Numeric-looking PKs come back as strings from PostgREST for bigint columns, but we type the
// ones we read/write as numbers and coerce at the wire (route handlers) where it matters.

// The three enum columns of issues_list (`dashboard.main_category`, `.issue_type`,
// `.vehicle_type`; the last is nullable). Their values are added in the DB — main categories as
// platforms onboard — so they are read from it (listIssueEnums), never listed here.
export type MainCategory = string;
export type IssueType = string;
export type VehicleType = string;

// The full domain of each enum, in declaration order.
export interface IssueEnums {
  mainCategories: string[];
  issueTypes: string[];
  vehicleTypes: string[];
}

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
