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
  /** Open add dialog with name prefilled (user completes category etc.). */
  onAddWithName: (name: string) => void;
  /** Open empty add dialog (e.g. tap button without name). */
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
        className="h-11 min-w-0 flex-1 rounded-xl border-primary/40 bg-card text-base shadow-sm"
        autoComplete="off"
        enterKeyHint="done"
      />
      <Button
        type="submit"
        disabled={disabled}
        className="h-11 shrink-0 gap-1 rounded-xl px-4"
      >
        <Plus className="h-4 w-4" />
        Lägg till
      </Button>
    </form>
  );
}
