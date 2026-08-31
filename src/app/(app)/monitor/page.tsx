import { listPlatforms } from "@/lib/sops/queries";
import { parseDate, parseFlags } from "@/lib/turns/nav";
import { MonitorDashboard } from "@/components/monitor-dashboard";

export const dynamic = "force-dynamic";

function toId(v: string | string[] | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// Production-monitor tab. Auth is enforced by the (app) layout.
//
// Unlike the SOP / Issue / Onboarding tabs there is no corpus to seed — ai_turns is 32k rows and
// grows by ~450/day — so the page seeds only the shell (platforms + the default range) and the
// feed loads client-side through /api/turns. That also means a filter change refetches without a
// navigation.
export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const platforms = await listPlatforms();
  const platformId = toId(params.platform) ?? platforms[0]?.id ?? null;

  // Compute the default window server-side and pass it down as stable values. Calling new Date()
  // or Date.now() in the client component's initial state would run with a different clock than
  // at SSR and mismatch at hydration (same reason as the Metrics tab) — so the feed's notion of
  // "now" is this request's clock, handed over as a number, not read again in the browser.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // A one-day window by default: this tab watches live production, and a wider range mostly
  // buries today's failures under a backlog you have already triaged.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <MonitorDashboard
      platforms={platforms}
      initialPlatformId={platformId}
      initialTurnId={toId(params.turn)}
      initialFrom={parseDate(params.from) ?? yesterday}
      initialTo={parseDate(params.to) ?? today}
      initialFlags={parseFlags(params.flags)}
      today={today}
      nowMs={now.getTime()}
    />
  );
}
