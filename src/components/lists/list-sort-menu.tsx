"use client";

import { useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListSortMode } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SORT_OPTIONS: { mode: ListSortMode; label: string }[] = [
  { mode: "manual", label: "Egen ordning" },
  { mode: "updated", label: "Senast ändrad" },
  { mode: "name", label: "Namn A–Ö" },
];

export function ListSortMenu({
  sortMode,
  onSortModeChange,
}: {
  sortMode: ListSortMode;
  onSortModeChange: (mode: ListSortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel =
    SORT_OPTIONS.find((o) => o.mode === sortMode)?.label ?? "Sortera";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl border bg-background px-3 text-sm text-muted-foreground active:bg-muted">
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{currentLabel}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Sortera listor</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 space-y-1 pb-2">
          {SORT_OPTIONS.map(({ mode, label }) => (
            <li key={mode}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm active:bg-muted",
                  sortMode === mode && "bg-primary/10 font-medium text-primary"
                )}
                onClick={() => {
                  onSortModeChange(mode);
                  setOpen(false);
                }}
              >
                {label}
                {sortMode === mode && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
        {sortMode === "manual" && (
          <p className="text-xs text-muted-foreground">
            Dra listor med handtaget för att ändra ordning.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
