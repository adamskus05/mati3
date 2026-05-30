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
  dense = false,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  variant?: "sheet" | "inline" | "scroll" | "chip";
  layout?: "wrap" | "grid";
  /** Compact chips for list footer (h-8). */
  dense?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "none" ? null : categories.find((c) => c.id === value);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  if (variant === "chip") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 active:bg-muted"
          aria-label={`Kategori: ${selected?.name ?? "Okategoriserad"}`}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: selected?.color ?? "#9CA3AF" }}
            aria-hidden
          />
          <span className="max-w-[5.5rem] truncate text-xs font-medium">
            {selected?.name ?? "Övrigt"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[min(85dvh,520px)] rounded-t-2xl px-0 pb-8"
          >
            <SheetHeader className="border-b border-border px-4 pb-3 text-left">
              <SheetTitle className="text-lg">Kategori vid tillägg</SheetTitle>
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
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (variant === "scroll" || variant === "inline") {
    const isScroll = variant === "scroll";
    const denseChips = dense ?? isScroll;
    return (
      <div className={denseChips ? "space-y-0" : "space-y-1.5"}>
        {!denseChips && (
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        )}
        <div
          className={cn(
            isScroll
              ? "flex gap-1.5 overflow-x-auto pb-0.5 snap-x snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]"
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
            dense={denseChips}
          />
          {categories.map((c) => (
            <InlineCategoryChip
              key={c.id}
              name={c.name}
              color={c.color}
              selected={value === c.id}
              onClick={() => onChange(c.id)}
              compact={isScroll}
              dense={denseChips}
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
  dense = false,
}: {
  name: string;
  color: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  dense?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 snap-start items-center gap-1.5 rounded-full border font-medium active:scale-[0.98]",
        dense
          ? "h-8 px-2.5 text-xs"
          : compact
            ? "h-[var(--mati-touch)] px-3 text-sm"
            : "min-h-[var(--mati-touch)] px-3 py-2 text-left text-sm",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/50 bg-muted/40 text-foreground"
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          dense ? "h-2 w-2" : "h-2.5 w-2.5 ring-2 ring-background"
        )}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className={cn("truncate", dense ? "max-w-[6rem]" : compact ? "max-w-[8rem]" : "")}>
        {name}
      </span>
      {selected && !dense && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
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
