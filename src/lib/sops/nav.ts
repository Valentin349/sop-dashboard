// URL-state helpers. Selection lives in the query string (?platform=&category=&sop=)
// so all DB reads stay in Server Components and every view is deep-linkable.

export interface SopSelection {
  platform?: number | null;
  category?: number | null;
  sop?: number | null;
}

export function sopHref(sel: SopSelection): string {
  const sp = new URLSearchParams();
  if (sel.platform != null) sp.set("platform", String(sel.platform));
  if (sel.category != null) sp.set("category", String(sel.category));
  if (sel.sop != null) sp.set("sop", String(sel.sop));
  const q = sp.toString();
  return q ? `/?${q}` : "/";
}

// metafield arrives as either a Python-dict-style string (single quotes, not valid JSON)
// or — for rows that happened to be valid JSON — an already-parsed object. Handle both.
export function parseMetafield(raw: unknown): {
  fn?: string;
  category?: string;
  mediaCount?: number;
} {
  if (raw == null) return {};

  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const media = o.media_paths;
    return {
      fn: typeof o.function === "string" ? o.function : undefined,
      category: typeof o.category === "string" ? o.category : undefined,
      mediaCount: Array.isArray(media) ? media.length : 0,
    };
  }

  const s = String(raw);
  const fn = s.match(/'function':\s*'([^']*)'/)?.[1];
  const category = s.match(/'category':\s*'([^']*)'/)?.[1];
  const media = s.match(/'media_paths':\s*\[([^\]]*)\]/)?.[1];
  const mediaCount = media ? media.split(",").filter((x) => x.trim()).length : 0;
  return { fn, category, mediaCount };
}
