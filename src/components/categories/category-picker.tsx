"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Category } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function CategoryPicker({
  categories,
  value,
  onChange,
  label = "Kategori",
  variant = "sheet",
  layout = "wrap",
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  variant?: "sheet" | "inline" | "scroll";
  layout?: "wrap" | "grid";
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "none" ? null : categories.find((c) => c.id === value);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  if (variant === "scroll" || variant === "inline") {
    const isScroll = variant === "scroll";
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            isScroll
              ? "flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]"
              : cn(
                  "gap-2",
                  layout === "grid" ? "grid grid-cols-2" : "flex flex-wrap"
                )
          )}
        >
          <InlineCategoryChip
            name="Okategoriserad"
            color="#9CA3AF"
            selected={value === "none"}
            onClick={() => onChange("none")}
            compact={isScroll}
          />
          {categories.map((c) => (
            <InlineCategoryChip
              key={c.id}
              name={c.name}
              color={c.color}
              selected={value === c.id}
              onClick={() => onChange(c.id)}
              compact={isScroll}
            />
          ))}
        </div>
        {categories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Inga kategorier – skapa under Kategorier i menyn.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-input bg-card px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-muted/40 active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full ring-2 ring-background"
            style={{
              backgroundColor: selected?.color ?? "#9CA3AF",
            }}
          />
          <span className="truncate font-medium">
            {selected?.name ?? "Okategoriserad"}
          </span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(85dvh,520px)] rounded-t-2xl px-0 pb-8"
        >
          <SheetHeader className="border-b border-border px-4 pb-3 text-left">
            <SheetTitle className="text-lg">Välj kategori</SheetTitle>
          </SheetHeader>
          <div className="flex max-h-[calc(85dvh-5rem)] flex-col gap-2 overflow-y-auto px-4 pt-3">
            <CategoryOption
              name="Okategoriserad"
              color="#9CA3AF"
              selected={value === "none"}
              onPick={() => pick("none")}
            />
            {categories.map((c) => (
              <CategoryOption
                key={c.id}
                name={c.name}
                color={c.color}
                selected={value === c.id}
                onPick={() => pick(c.id)}
              />
            ))}
            {categories.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Inga kategorier ännu. Skapa under Kategorier i menyn.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InlineCategoryChip({
  name,
  color,
  selected,
  onClick,
  compact = false,
}: {
  name: string;
  color: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 font-medium active:scale-[0.98]",
        compact
          ? "h-[var(--mati-touch)] shrink-0 snap-start px-3 text-sm"
          : "min-h-[var(--mati-touch)] px-3 py-2 text-left text-sm",
        selected
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border/50 bg-card text-foreground"
      )}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className={cn("truncate", compact ? "max-w-[8rem]" : "min-w-0 flex-1")}>
        {name}
      </span>
      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  );
}

function CategoryOption({
  name,
  color,
  selected,
  onPick,
}: {
  name: string;
  color: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/10"
          : "border-transparent bg-muted/50 hover:bg-muted"
      )}
    >
      <span
        className="h-5 w-5 shrink-0 rounded-full ring-2 ring-background"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 font-medium">{name}</span>
      {selected && <Check className="h-5 w-5 text-primary" />}
    </button>
  );
}
