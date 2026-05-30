"use client";

import { cn } from "@/lib/utils";
import type { Category } from "@/lib/database.types";

export function ListFilters({
  hideCompleted,
  onHideCompletedChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  selectMode,
  onSelectModeChange,
  readOnly,
}: {
  hideCompleted: boolean;
  onHideCompletedChange: (v: boolean) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (id: string | null) => void;
  categories: Category[];
  selectMode: boolean;
  onSelectModeChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  if (readOnly) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterChip
        active={hideCompleted}
        onClick={() => onHideCompletedChange(!hideCompleted)}
        label="Dölj klara"
      />
      <FilterChip
        active={categoryFilter === null}
        onClick={() => onCategoryFilterChange(null)}
        label="Alla kat."
      />
      {categories.map((c) => (
        <FilterChip
          key={c.id}
          active={categoryFilter === c.id}
          onClick={() => onCategoryFilterChange(c.id)}
          label={c.name}
        />
      ))}
      <FilterChip
        active={selectMode}
        onClick={() => onSelectModeChange(!selectMode)}
        label="Välj"
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors active:opacity-80",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}
