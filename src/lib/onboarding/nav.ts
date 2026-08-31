// URL-state helpers for the Onboarding tab. Selection lives in the query string
// (?platform=&product=&topic=) so the page is deep-linkable; the client syncs it with
// window.history.replaceState (pathname stays "/onboarding", no navigation).

// A curriculum row may have no product (Deliveroo's 10 topics are platform-wide). That bucket
// needs an address of its own, so a product selection is a *key*: the id as a string, or "none".
// null means no product picked yet.
export const NO_PRODUCT = "none";
export type ProductKey = string;

export function productKey(productId: number | null): ProductKey {
  return productId == null ? NO_PRODUCT : String(productId);
}

// Back to a column value for writes. "none" → null (the DB stores no product).
export function productIdFromKey(key: ProductKey | null): number | null {
  if (key == null || key === NO_PRODUCT) return null;
  const n = Number(key);
  return Number.isInteger(n) ? n : null;
}

export interface TopicSelection {
  platform?: number | null;
  product?: ProductKey | null;
  topic?: number | null;
}

export function onboardingHref(sel: TopicSelection): string {
  const sp = new URLSearchParams();
  if (sel.platform != null) sp.set("platform", String(sel.platform));
  if (sel.product != null) sp.set("product", sel.product);
  if (sel.topic != null) sp.set("topic", String(sel.topic));
  const q = sp.toString();
  return q ? `/onboarding?${q}` : "/onboarding";
}
