"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Category, ShoppingItemWithCompleter } from "@/lib/database.types";
import { ItemRow } from "@/components/items/item-row";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CategorySection({
  category,
  items,
  readOnly,
  selectMode,
  selectedIds,
  onSelectToggle,
  onToggle,
  onEdit,
  onDelete,
}: {
  category: Category | null;
  items: ShoppingItemWithCompleter[];
  readOnly?: boolean;
  selectMode?: boolean;
  selectedIds: Set<string>;
  onSelectToggle: (id: string) => void;
  onToggle: (item: ShoppingItemWithCompleter) => void;
  onEdit: (item: ShoppingItemWithCompleter) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const title = category?.name ?? "Okategoriserad";
  const color = category?.color ?? "#9CA3AF";

  return (
    <section
      className={cn(
        "mati-category-section",
        readOnly ? "space-y-1" : "space-y-2"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Badge
          className={cn(
            "rounded-full border-0 text-white",
            readOnly ? "px-1.5 py-0 text-[10px] font-medium" : "text-xs"
          )}
          style={{ backgroundColor: color }}
        >
          {title}
        </Badge>
        <span
          className={cn(
            "text-muted-foreground",
            readOnly ? "text-[10px]" : "text-xs"
          )}
        >
          {items.length}
        </span>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-1">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              readOnly={readOnly}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onSelectToggle={() => onSelectToggle(item.id)}
              onToggle={() => onToggle(item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}
