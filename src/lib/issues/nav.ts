// URL-state helpers for the Issue lists tab. Selection lives in the query string
// (?platform=&issue=) so the page is deep-linkable; the client syncs it with
// window.history.replaceState (pathname stays "/issues", no navigation).

export interface IssueSelection {
  platform?: number | null;
  issue?: number | null;
}

export function issueHref(sel: IssueSelection): string {
  const sp = new URLSearchParams();
  if (sel.platform != null) sp.set("platform", String(sel.platform));
  if (sel.issue != null) sp.set("issue", String(sel.issue));
  const q = sp.toString();
  return q ? `/issues?${q}` : "/issues";
}
