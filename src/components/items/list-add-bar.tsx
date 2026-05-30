"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ListAddBar({
  onQuickAdd,
  onOpenForm,
  disabled,
}: {
  /** Add immediately with last-used category (no sheet). */
  onQuickAdd: (name: string) => void;
  /** Open full form (category, qty, notes). */
  onOpenForm: (prefillName?: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const name = value.trim();
    if (name) {
      onQuickAdd(name);
      setValue("");
    }
  }

  return (
    <form
      className="mati-add-bar flex gap-2"
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
        className="mati-input h-[var(--mati-touch)] min-w-0 flex-1 rounded-xl border-border/60 bg-card text-[length:var(--mati-text-input)] shadow-none"
        autoComplete="off"
        enterKeyHint="done"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        className="h-[var(--mati-touch)] w-[var(--mati-touch)] shrink-0 rounded-xl"
        aria-label="Lägg till med detaljer"
        onClick={() => onOpenForm(value.trim() || undefined)}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      <Button
        type="submit"
        disabled={disabled}
        className="h-[var(--mati-touch)] shrink-0 gap-1 rounded-xl px-3"
      >
        <Plus className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:inline">Lägg till</span>
      </Button>
    </form>
  );
}
