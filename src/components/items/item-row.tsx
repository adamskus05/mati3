"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { profileDisplayName } from "@/lib/profiles/display-name";

function ItemRowInner({
  item,
  readOnly,
  selectMode,
  selected,
  onSelectToggle,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItemWithCompleter;
  readOnly?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: readOnly || selectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const qty =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
      : item.unit ?? "";

  const completedBy =
    item.completed && item.completer
      ? profileDisplayName(item.completer)
      : null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-transparent bg-card px-1.5 py-1",
        item.completed && "opacity-50",
        isDragging && "z-10 border-border shadow-lg",
        selected && "border-primary/40 bg-primary/5"
      )}
    >
      {selectMode && !readOnly && (
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectToggle}
          aria-label={`Välj ${item.name}`}
        />
      )}
      {!readOnly && !selectMode && (
        <button
          type="button"
          className="touch-none text-muted-foreground active:opacity-60"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Checkbox
        checked={item.completed}
        onCheckedChange={onToggle}
        disabled={readOnly || selectMode}
        className="size-3.5 rounded-full"
      />
      <button
        type="button"
        className="min-w-0 flex-1 text-left active:opacity-70"
        onClick={selectMode ? onSelectToggle : onToggle}
        disabled={readOnly}
      >
        <span
          className={cn(
            "block text-sm font-medium leading-tight",
            item.completed && "text-muted-foreground line-through"
          )}
        >
          {item.name}
        </span>
        {qty && (
          <span className="text-[11px] leading-tight text-muted-foreground">
            {qty}
          </span>
        )}
        {item.notes && (
          <span className="block text-[11px] leading-tight italic text-muted-foreground">
            {item.notes}
          </span>
        )}
        {completedBy && (
          <span className="block text-[10px] leading-tight text-muted-foreground">
            Av {completedBy}
          </span>
        )}
      </button>
      {!readOnly && !selectMode && (
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      )}
    </li>
  );
}

export const ItemRow = memo(ItemRowInner);
