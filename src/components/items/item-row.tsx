"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ShoppingItem } from "@/lib/database.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ItemRow({
  item,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem;
  readOnly?: boolean;
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
  } = useSortable({ id: item.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const qty =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
      : item.unit ?? "";

  return (
    <motion.li
      ref={setNodeRef}
      style={style}
      layout
      className={cn(
        "flex items-center gap-2 rounded-xl border border-transparent bg-card px-2 py-2.5",
        item.completed && "opacity-50",
        isDragging && "z-10 shadow-lg border-border"
      )}
    >
      {!readOnly && (
        <button
          type="button"
          className="touch-none text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <Checkbox
        checked={item.completed}
        onCheckedChange={onToggle}
        disabled={readOnly}
        className="rounded-full"
      />
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={onToggle}
        disabled={readOnly}
      >
        <span
          className={cn(
            "block font-medium",
            item.completed && "line-through text-muted-foreground"
          )}
        >
          {item.name}
        </span>
        {qty && (
          <span className="text-xs text-muted-foreground">{qty}</span>
        )}
        {item.notes && (
          <span className="block text-xs text-muted-foreground italic">
            {item.notes}
          </span>
        )}
      </button>
      {!readOnly && (
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </motion.li>
  );
}
