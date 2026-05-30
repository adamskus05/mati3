"use client";

import { useMemo, useState } from "react";
import { Check, ListFilter, SquareCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [open, setOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (hideCompleted) n++;
    if (categoryFilter !== null) n++;
    return n;
  }, [hideCompleted, categoryFilter]);

  if (readOnly) return null;

  function clearFilters() {
    onHideCompletedChange(false);
    onCategoryFilterChange(null);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className={cn(
            "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background active:bg-muted",
            activeFilterCount > 0 && "border-primary/50"
          )}
          aria-label="Filtrera varor"
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filtrera</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5 pb-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm active:bg-muted"
              onClick={() => onHideCompletedChange(!hideCompleted)}
            >
              <span>Dölj avbockade</span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md border",
                  hideCompleted && "border-primary bg-primary text-primary-foreground"
                )}
              >
                {hideCompleted && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Kategori</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                <CategoryOption
                  label="Alla kategorier"
                  active={categoryFilter === null}
                  onClick={() => {
                    onCategoryFilterChange(null);
                    setOpen(false);
                  }}
                />
                {categories.map((c) => (
                  <CategoryOption
                    key={c.id}
                    label={c.name}
                    color={c.color}
                    active={categoryFilter === c.id}
                    onClick={() => {
                      onCategoryFilterChange(c.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            </div>

            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  clearFilters();
                  setOpen(false);
                }}
              >
                Rensa filter
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Button
        type="button"
        variant={selectMode ? "default" : "outline"}
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        aria-label={selectMode ? "Avsluta val-läge" : "Välj flera varor"}
        aria-pressed={selectMode}
        onClick={() => onSelectModeChange(!selectMode)}
      >
        <SquareCheck className="h-4 w-4" />
      </Button>
    </>
  );
}

function CategoryOption({
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
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm active:bg-muted",
          active && "bg-primary/10 font-medium text-primary"
        )}
      >
        {color ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : null}
        <span className="flex-1 truncate text-left">{label}</span>
        {active && <Check className="h-4 w-4 shrink-0" />}
      </button>
    </li>
  );
}
