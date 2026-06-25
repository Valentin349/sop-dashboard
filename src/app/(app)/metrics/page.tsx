import { listPlatforms } from "@/lib/sops/queries";
import { MetricsDashboard } from "@/components/metrics-dashboard";

export const dynamic = "force-dynamic";

// Engagement-metrics tab. Auth is enforced by the (app) layout. Metric data is loaded client-side
// through /api/metrics so date-range / platform filters refetch without a navigation; the page
// only seeds the platform list and the default date range.
export default async function MetricsPage() {
  const platforms = await listPlatforms();
  // Compute the default date range on the server and hand it to the client as stable strings.
  // Calling new Date() in the client component's initial state would run with a different
  // clock/timezone at hydration than at SSR, mismatching the date-range inputs. Default window is
  // the last 7 days (today − 7d → today).
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <MetricsDashboard platforms={platforms} today={today} defaultStart={defaultStart} />
  );
}
