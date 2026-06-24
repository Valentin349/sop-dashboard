// Pure-markup skeletons shown via Suspense while a platform/category change refetches.
// Widths mirror the real layout so nothing shifts when content streams in.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
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
