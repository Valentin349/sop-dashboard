// Pure-markup skeletons shown via Suspense while a platform/category change refetches.
// Widths mirror the real layout so nothing shifts when content streams in.

function Bar({ className = "" }: { className?: string }) {
  // bg-muted is 3% off the page background — invisible once animate-pulse halves it. A tint of
  // the foreground reads in both themes.
  return <div className={`animate-pulse rounded bg-foreground/10 ${className}`} />;
}

export function CategoryNavSkeleton() {
  return (
    <div className="space-y-0.5" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <Bar className="h-3.5 w-2/5" />
            <Bar className="h-3 w-4" />
          </div>
          <Bar className="mt-1.5 h-2.5 w-full opacity-70" />
        </div>
      ))}
    </div>
  );
}

export function SopListSkeleton() {
  return (
    <div aria-hidden>
      <div className="px-4 py-3">
        <Bar className="h-9 w-full" />
      </div>
      <div className="space-y-1 px-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="px-3 py-2.5">
            <Bar className="h-3.5 w-3/4" />
            <Bar className="mt-1.5 h-2.5 w-full opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <>
      <aside className="flex w-80 shrink-0 flex-col border-r bg-background" aria-hidden>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <Bar className="h-4 w-1/3" />
          <Bar className="h-3 w-4" />
        </div>
        <div className="px-4 py-3">
          <Bar className="h-9 w-full" />
        </div>
        <div className="space-y-1 px-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5">
              <Bar className="h-3.5 w-3/4" />
              <Bar className="mt-1.5 h-2.5 w-full opacity-70" />
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 bg-background" aria-hidden />
    </>
  );
}

// History view while its versions load: the rail of entries and a diff-shaped block, so the
// real content lands in place with no shift. Line widths vary like prose does.
const DIFF_WIDTHS = [
  "w-3/5",
  "w-full",
  "w-11/12",
  "w-2/5",
  "w-full",
  "w-4/5",
  "w-1/3",
  "w-full",
  "w-5/6",
  "w-3/4",
  "w-1/2",
  "w-11/12",
];

export function SopHistorySkeleton() {
  return (
    <div className="flex min-h-0 flex-1" aria-hidden>
      <nav className="w-64 shrink-0 space-y-0.5 border-r py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-l-2 border-l-transparent px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Bar className="h-3 w-7" />
              <Bar className="h-3 w-2/5" />
            </div>
            <Bar className="mt-1.5 h-2.5 w-1/2 opacity-70" />
            <Bar className="mt-1 h-2.5 w-3/4 opacity-70" />
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div className="max-w-4xl space-y-4 px-12 py-8">
          <div className="flex items-center gap-3">
            <Bar className="h-3.5 w-8" />
            <Bar className="h-3 w-1/3" />
            <Bar className="ml-auto h-6 w-32" />
          </div>
          <Bar className="h-2.5 w-24 opacity-70" />
          <div className="space-y-2.5 rounded-md border px-3 py-3">
            {DIFF_WIDTHS.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bar className="h-3 w-2 opacity-50" />
                <Bar className={`h-3 ${w}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Onboarding topic view while the bodies load: the header block and two runs of numbered lines,
// matching the real article so the content lands in place.
export function OnboardingTopicSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      <div className="border-b px-12 py-3">
        <Bar className="h-4 w-1/3" />
      </div>
      <div className="max-w-4xl px-12 py-12">
        <Bar className="h-7 w-2/3" />
        <Bar className="mt-3 h-3 w-1/3 opacity-70" />
        <div className="mt-10 space-y-8">
          {[6, 3].map((lines, section) => (
            <div key={section}>
              <Bar className="h-2.5 w-20 opacity-70" />
              <div className="mt-3 space-y-2.5">
                {Array.from({ length: lines }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Bar className="h-3.5 w-4 opacity-50" />
                    <Bar className={`h-3.5 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Monitor turn detail while it loads: the breadcrumb, a heading block, and the stacked sections
// (why flagged → what the AI said → conversation) so the real content lands in place.
export function MonitorTurnSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      <div className="flex items-center gap-2 border-b px-12 py-3">
        <Bar className="h-3.5 w-24" />
        <Bar className="h-3.5 w-20" />
      </div>
      <div className="max-w-4xl px-12 py-10">
        <Bar className="h-6 w-3/5" />
        <Bar className="mt-3 h-3 w-2/5 opacity-70" />
        <div className="mt-8 space-y-8">
          {[3, 2, 4].map((lines, section) => (
            <div key={section}>
              <Bar className="h-2.5 w-24 opacity-70" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: lines }).map((_, i) => (
                  <Bar key={i} className={`h-9 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
