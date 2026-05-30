"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function QuickAddBar({
  onAdd,
  disabled,
}: {
  onAdd: (name: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const name = value.trim();
    if (!name) return;
    onAdd(name);
    setValue("");
  }

  return (
    <form
      className="flex gap-2"
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
        className="h-10 flex-1 rounded-xl"
        autoComplete="off"
      />
      <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={disabled}>
        <Plus className="h-4 w-4" />
        <span className="sr-only">Lägg till</span>
      </Button>
    </form>
  );
}
