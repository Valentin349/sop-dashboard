// SOP variables: named values a writer drops into a SOP body as {{TOKEN}}.
//
// knowledge_base.content holds the tokens — it is the authored text. Substitution happens once,
// on the way into the vector store: nothing reads knowledge_base.content at runtime (the agent's
// sop_search returns documents.content), so the index rebuild is the single place where a SOP
// becomes the words a driver's message is matched against. That keeps §1 of the standard true —
// the embedding sees "350,000Kz", never a placeholder.
//
// The dashboard substitutes for display only. Nothing here touches the DB; it is safe in a
// Client Component.

export const VARIABLE_NAME_RE = /^[A-Z][A-Z0-9_]*$/;

// Tolerant on read (inner spaces allowed), strict on write — `token()` is the only writer.
const TOKEN_RE = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;

export function token(name: string): string {
  return `{{${name}}}`;
}

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME_RE.test(name);
}

/** Every variable name referenced by the text, de-duplicated, in the order it first appears. */
export function tokensIn(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) seen.add(m[1]);
  return [...seen];
}

/** How many times one variable appears — what the writer sees before changing a value. */
export function countToken(text: string | null | undefined, name: string): number {
  if (!text) return 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN_RE)) if (m[1] === name) n++;
  return n;
}

export type VariableValues = Map<string, string> | Record<string, string>;

function lookup(values: VariableValues, name: string): string | undefined {
  return values instanceof Map ? values.get(name) : values[name];
}

/**
 * Substitute values into an authored body. Unknown tokens are left in place and reported rather
 * than blanked — publishing an empty string where a number belongs is worse than publishing
 * nothing, and the caller refuses the save.
 */
export function renderContent(
  source: string | null | undefined,
  values: VariableValues,
): { content: string; missing: string[] } {
  if (!source) return { content: "", missing: [] };
  const missing: string[] = [];
  const content = source.replace(TOKEN_RE, (whole, name: string) => {
    const value = lookup(values, name);
    if (value == null) {
      if (!missing.includes(name)) missing.push(name);
      return whole;
    }
    return value;
  });
  return { content, missing };
}

/** Rewrite one token across a body — used when a variable is renamed. */
export function renameToken(source: string, from: string, to: string): string {
  return source.replace(TOKEN_RE, (whole, name: string) =>
    name === from ? token(to) : whole,
  );
}
