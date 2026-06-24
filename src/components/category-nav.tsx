"use client";

import { memo } from "react";
import { Pencil } from "lucide-react";

import type { CategoryWithCount } from "@/lib/sops/queries";
import { cn } from "@/lib/utils";

export const CategoryNav = memo(function CategoryNav({
  categories,
  currentCategoryId,
  onSelect,
  onEdit,
}: {
  categories: CategoryWithCount[];
  currentCategoryId: number | null;
  onSelect: (categoryId: number) => void;
  onEdit: (category: CategoryWithCount) => void;
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
          <div
            key={cat.id}
            className={cn(
              "group relative rounded-md transition-colors",
              active ? "bg-accent" : "hover:bg-accent/60",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(cat.id)}
              className="block w-full rounded-md px-3 py-2 pr-8 text-left"
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
            <button
              type="button"
              onClick={() => onEdit(cat)}
              title="Edit category"
              aria-label="Edit category"
              className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        );
      })}
    </nav>
  );
});
