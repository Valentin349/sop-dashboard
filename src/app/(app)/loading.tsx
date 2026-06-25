// Content skeleton for the SOP dashboard (/). The persistent TopBar lives in the (app) layout and
// stays put; this only fills the page area below it while platforms/categories/products load.
export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-72 shrink-0 flex-col gap-3 border-r bg-sidebar p-3">
        <div className="h-9 w-full animate-pulse rounded-md bg-muted-foreground/15" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 w-full animate-pulse rounded bg-muted-foreground/15" />
          ))}
        </div>
      </aside>
      <div className="w-80 shrink-0 border-r bg-background p-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-muted-foreground/15" />
          ))}
        </div>
      </div>
      <div className="flex-1 bg-background" />
    </div>
  );
}
