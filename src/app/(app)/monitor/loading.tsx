// Content skeleton for the Monitor tab (/monitor). The persistent TopBar lives in the (app)
// layout and stays put; this only fills the page area below it while the shell loads.
export default function Loading() {
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-[340px] shrink-0 flex-col gap-3 border-r bg-sidebar p-3">
        <div className="h-10 w-full animate-pulse rounded-md bg-foreground/10" />
        <div className="h-8 w-full animate-pulse rounded-md bg-foreground/10" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded bg-foreground/10" />
          ))}
        </div>
      </aside>
      <div className="flex-1 bg-background" />
    </div>
  );
}
