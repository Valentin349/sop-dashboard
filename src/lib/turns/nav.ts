// URL-state helpers for the Monitor tab. Selection and filters live in the query string
// (?platform=&turn=&from=&to=&flags=) so a flagged turn is deep-linkable — the point being that
// you can paste one at a colleague. The client syncs it with window.history.replaceState
// (pathname stays "/monitor", no navigation).

import { isTurnFlag, type TurnFlag } from "./types";

export interface MonitorSelection {
  platform?: number | null;
  turn?: number | null;
  from?: string | null;
  to?: string | null;
  flags?: TurnFlag[];
}

export function monitorHref(sel: MonitorSelection): string {
  const sp = new URLSearchParams();
  if (sel.platform != null) sp.set("platform", String(sel.platform));
  if (sel.turn != null) sp.set("turn", String(sel.turn));
  if (sel.from) sp.set("from", sel.from);
  if (sel.to) sp.set("to", sel.to);
  if (sel.flags && sel.flags.length > 0) sp.set("flags", sel.flags.join(","));
  const q = sp.toString();
  return q ? `/monitor?${q}` : "/monitor";
}

// "escalated,invalid" → ["escalated", "invalid"]. Unknown names are dropped rather than
// rejected, so an old or hand-edited link still opens.
export function parseFlags(raw: string | string[] | undefined | null): TurnFlag[] {
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(isTurnFlag))];
}

// "YYYY-MM-DD" or nothing. Guards against a hand-edited date reaching a DB filter.
export function parseDate(raw: string | string[] | undefined | null): string | null {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
