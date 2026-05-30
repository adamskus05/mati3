"use client";

import { cn } from "@/lib/utils";
import type { RecipeCategory } from "@/lib/database.types";

export type RecipeCategoryFilter = "all" | "uncategorized" | string;

export function RecipeCategoryFilterBar({
  categories,
  value,
  onChange,
}: {
  categories: RecipeCategory[];
  value: RecipeCategoryFilter;
  onChange: (value: RecipeCategoryFilter) => void;
}) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
      role="tablist"
      aria-label="Filtrera recept"
    >
      <FilterChip
        label="Alla"
        active={value === "all"}
        onClick={() => onChange("all")}
      />
      {categories.map((cat) => (
        <FilterChip
          key={cat.id}
          label={cat.name}
          color={cat.color}
          active={value === cat.id}
          onClick={() => onChange(cat.id)}
        />
      ))}
      <FilterChip
        label="Okategoriserade"
        active={value === "uncategorized"}
        onClick={() => onChange("uncategorized")}
      />
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50"
      )}
    >
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
  );
}
