"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ListAddBar({
  onAddWithName,
  onOpenForm,
  disabled,
}: {
  onAddWithName: (name: string) => void;
  onOpenForm: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const name = value.trim();
    if (name) {
      onAddWithName(name);
      setValue("");
    } else {
      onOpenForm();
    }
  }

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3 shadow-sm">
      <p className="mb-2 text-xs font-medium text-primary">Lägg till vara</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          placeholder="Vad behövs?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-background text-base shadow-none"
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button
          type="submit"
          disabled={disabled}
          className="h-11 shrink-0 gap-1 rounded-xl px-4 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Lägg till
        </Button>
      </form>
    </div>
  );
}
