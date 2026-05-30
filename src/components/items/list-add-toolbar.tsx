"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Category, ItemPreset } from "@/lib/database.types";
import { CategoryPicker } from "@/components/categories/category-picker";
import { ListAddBar } from "@/components/items/list-add-bar";
import { PresetChips } from "@/components/items/preset-chips";
import { cn } from "@/lib/utils";

export function ListAddToolbar({
  categories,
  categoryId,
  onCategoryChange,
  onQuickAdd,
  onOpenForm,
  presets,
  onPresetSelect,
}: {
  categories: Category[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  onQuickAdd: (name: string) => void;
  onOpenForm: (prefillName?: string) => void;
  presets: ItemPreset[];
  onPresetSelect: (preset: ItemPreset) => void;
}) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CategoryPicker
          variant="chip"
          categories={categories}
          value={categoryId}
          onChange={onCategoryChange}
        />
        <div className="min-w-0 flex-1">
          <ListAddBar onQuickAdd={onQuickAdd} onOpenForm={onOpenForm} />
        </div>
      </div>
      {presets.length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground active:opacity-70"
            onClick={() => setPresetsOpen((o) => !o)}
            aria-expanded={presetsOpen}
          >
            Snabbval
            <span className="text-muted-foreground/80">({presets.length})</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                presetsOpen && "rotate-180"
              )}
            />
          </button>
          {presetsOpen && (
            <div className="mt-1.5">
              <PresetChips presets={presets} onSelect={onPresetSelect} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
