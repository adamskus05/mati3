"use client";

import type { ItemPreset } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

export function PresetChips({
  presets,
  onSelect,
}: {
  presets: ItemPreset[];
  onSelect: (preset: ItemPreset) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {presets.map((p) => (
        <Button
          key={p.id}
          variant="secondary"
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => onSelect(p)}
        >
          {p.name}
        </Button>
      ))}
    </div>
  );
}
