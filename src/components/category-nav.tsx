"use client";

import { memo } from "react";

import type { CategoryWithCount } from "@/lib/sops/queries";
import { cn } from "@/lib/utils";

export const CategoryNav = memo(function CategoryNav({
  categories,
  currentCategoryId,
  onSelect,
}: {
  categories: CategoryWithCount[];
  currentCategoryId: number | null;
  onSelect: (categoryId: number) => void;
}) {
  if (categories.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-muted-foreground">
        No categories for this platform.
      </p>
    );
  }

  return (
    <nav className="space-y-0.5">
      {categories.map((cat) => {
        const active = cat.id === currentCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              "block w-full rounded-md px-3 py-2 text-left transition-colors",
              active ? "bg-accent" : "hover:bg-accent/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[13px] font-medium",
                  active ? "text-foreground" : "text-foreground/90",
                )}
              >
                {cat.name ?? `Category ${cat.id}`}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {cat.sopCount}
              </span>
            </div>
            {cat.description && (
              <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {cat.description}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
});
