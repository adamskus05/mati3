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
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
      {presets.map((p) => (
        <Button
          key={p.id}
          variant="secondary"
          size="sm"
          className="h-8 shrink-0 snap-start rounded-full px-3 text-xs"
          onClick={() => onSelect(p)}
        >
          {p.name}
        </Button>
      ))}
    </div>
  );
}
