// Shapes mirror the live Supabase columns (verified against the DB).
// Numeric-looking PKs come back as strings from PostgREST for bigint columns.

export interface KnowledgeBaseRow {
  id: number;
  created_at: string;
  title: string | null;
  content: string | null;
  document_id: string | null;
  platform_id: number | null;
  category_id: number | null;
  is_come_back: boolean | null;
  // Upstream this is a json-ish blob (category / function / media_paths / ...). Comes back
  // as a string for Python-dict-style rows, or a parsed object for valid-JSON rows.
  metafield: string | Record<string, unknown> | null;
  data_source: string | null;
  // Tags. product_tags holds crm.products ids; the other two hold fixed enum strings.
  product_tags: number[];
  vehicle_tags: string[];
  driver_status_tags: string[];
}

// A named value substituted into SOP bodies on publish. Scoped to a platform: a weekly earnings
// target in Kz belongs to Anda, not to Bolt.
export interface SopVariableRow {
  id: number;
  platform_id: number;
  name: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Why a SOP version exists. The app sets the first four after a save; the backfill in
// db/sop-versions.sql set the last two. null means the trigger saw an edit the app didn't make.
export type ChangeKind =
  | "create"
  | "edit"
  | "variable_rename"
  | "restore"
  | "baseline"
  | "pre_variables";

// One snapshot of a SOP's editable fields, written by the knowledge_base trigger on every save
// that changes one of them (db/sop-versions.sql). Newest 50 per SOP are kept.
export interface KnowledgeBaseVersionRow {
  id: number;
  knowledge_base_id: number;
  version_no: number;
  title: string | null;
  content: string | null;
  category_id: number | null;
  is_come_back: boolean | null;
  product_tags: number[] | null;
  vehicle_tags: string[] | null;
  driver_status_tags: string[] | null;
  change_kind: ChangeKind | null;
  changed_by: string | null;
  changed_at: string;
}

export interface ProductRow {
  id: number;
  name: string | null;
  platform_id: number | null;
  active: boolean | null;
}

// One media asset attached to a SOP. The object lives in a private storage bucket at
// `path/filename`; the browser can't read it directly, so the server hands back a signed URL.
export interface KnowledgeBaseMediaRow {
  id: number;
  name: string | null;
  created_at: string;
  bucket: string | null;
  path: string | null;
  filename: string | null;
  media_type: string | null; // "image" | "video"
  knowledge_base_id: number;
  index: number | null;
  description: string | null;
}

// A media row enriched with a short-lived signed URL, safe to send to the client.
export interface SopMedia {
  id: number;
  url: string;
  mediaType: string;
  description: string | null;
  index: number | null;
}

export interface CategoryRow {
  id: number;
  created_at: string;
  name: string | null;
  platform_id: number | null;
  description: string | null;
}

export interface PlatformRow {
  id: number;
  code: string | null;
  name: string | null;
  fleet_partner: string | null;
  bucket: string | null;
}
