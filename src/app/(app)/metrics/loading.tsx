import { cn } from "@/lib/utils";

// Content skeleton for /metrics. The persistent TopBar lives in the (app) layout; this mirrors the
// MetricsDashboard template (controls + KPI cards + breakdown table) with a visible shimmer, so
// the page reads as "loading" the instant you navigate, then fills in seamlessly.
export default function Loading() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* controls row */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b bg-sidebar px-4 py-3">
        <div className="h-9 w-60 animate-pulse rounded bg-muted-foreground/15" />
        <div className="h-9 w-72 animate-pulse rounded bg-muted-foreground/15" />
        <div className="ml-auto h-9 w-24 animate-pulse rounded bg-muted-foreground/15" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-muted-foreground/15" />
              <div className="mt-3 h-8 w-28 animate-pulse rounded bg-muted-foreground/15" />
              <div className="mt-3 h-3 w-36 animate-pulse rounded bg-muted-foreground/15" />
            </div>
          ))}
        </div>

        {/* breakdown table — mirrors the default (response-rate) columns: 2 text + 3 numeric */}
        <div className="mt-6">
          <div className="mb-2 h-5 w-48 animate-pulse rounded bg-muted-foreground/15" />
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["Agent", "Platform", "Coached", "Engaged", "Rate"].map((h, i) => (
                    <th
                      key={h}
                      className={cn("px-3 py-2 font-medium", i >= 2 && "text-right")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, r) => (
                  <tr key={r} className={cn(r % 2 === 1 && "bg-muted-foreground/15")}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <td key={i} className={cn("px-3 py-2", i >= 2 && "text-right")}>
                        <div
                          className={cn(
                            "h-3.5 animate-pulse rounded bg-muted-foreground/20",
                            i >= 2 ? "ml-auto w-12" : i === 0 ? "w-24" : "w-16",
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
