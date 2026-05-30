"use client";

import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Category } from "@/lib/database.types";

export function BulkActionsBar({
  count,
  categories,
  onComplete,
  onDelete,
  onMoveCategory,
  onCancel,
}: {
  count: number;
  categories: Category[];
  onComplete: () => void;
  onDelete: () => void;
  onMoveCategory: (categoryId: string | null) => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-30 mati-bleed-x border-t border-border bg-background/95 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{count} valda</span>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={onComplete}>
          <Check className="h-3.5 w-3.5" />
          Klara
        </Button>
        <Select
          onValueChange={(v) => {
            if (!v || typeof v !== "string") return;
            onMoveCategory(v === "none" ? null : v);
          }}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <span className="text-xs">Flytta till…</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Okategoriserad</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="destructive" className="gap-1" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Ta bort
        </Button>
        <Button type="button" size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
