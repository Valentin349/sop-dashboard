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
