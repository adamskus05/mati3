"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ListAddBar({
  onQuickAdd,
  onOpenForm,
  disabled,
  compact = true,
}: {
  /** Add immediately with last-used category (no sheet). */
  onQuickAdd: (name: string) => void;
  /** Open full form (category, qty, notes). */
  onOpenForm: (prefillName?: string) => void;
  disabled?: boolean;
  /** Smaller bar for list footer (default). */
  compact?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const name = value.trim();
    if (name) {
      onQuickAdd(name);
      setValue("");
    }
  }

  const controlH = compact ? "h-10" : "h-[var(--mati-touch)]";

  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        placeholder="Lägg till vara…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 rounded-lg border-border/60 bg-card shadow-none",
          controlH,
          compact ? "text-sm" : "text-[length:var(--mati-text-input)]"
        )}
        autoComplete="off"
        enterKeyHint="done"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className={cn(controlH, "w-10 shrink-0 rounded-lg")}
        aria-label="Lägg till med detaljer"
        onClick={() => onOpenForm(value.trim() || undefined)}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      <Button
        type="submit"
        disabled={disabled}
        size="icon"
        className={cn(controlH, "w-10 shrink-0 rounded-lg")}
        aria-label="Lägg till"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
