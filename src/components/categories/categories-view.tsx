"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS, CATEGORY_COLORS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import type { Category } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteCategoryDialog } from "@/components/categories/delete-category-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { showQueryLoading } from "@/lib/query/loading";

function SortableCategory({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 border-b border-border/60 px-2 py-2 last:border-b-0",
        isDragging && "z-10 bg-muted/80 shadow-sm"
      )}
    >
      <button
        type="button"
        className="touch-none shrink-0 p-1 text-muted-foreground active:opacity-60"
        aria-label="Flytta kategori"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/5"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</span>
      <div className="flex shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
          aria-label={`Redigera ${category.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Ta bort ${category.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function CategoryForm({
  name,
  color,
  onNameChange,
  onColorChange,
  onSubmit,
}: {
  name: string;
  color: string;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="catName" className="text-xs">
          Namn
        </Label>
        <Input
          id="catName"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          className="h-9 rounded-lg"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Färg</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "h-7 w-7 rounded-full ring-2 ring-offset-1 transition-transform active:scale-95",
                color === c ? "ring-primary" : "ring-transparent"
              )}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              aria-label={`Välj färg ${c}`}
            />
          ))}
        </div>
        <Input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-8 w-full cursor-pointer rounded-lg p-0.5"
        />
      </div>
      <Button type="submit" className="h-9 w-full rounded-lg">
        Spara
      </Button>
    </form>
  );
}

export function CategoriesView({ householdId }: { householdId: string }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);

  useHouseholdRealtime(householdId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: categories = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.categories(householdId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("categories")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
  });

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    const supabase = createClient();
    if (editCat) {
      const { error } = await supabase
        .from("categories")
        .update({ name: name.trim(), color })
        .eq("id", editCat.id);
      if (error) toast.error(error.message);
      else {
        setEditCat(null);
        setOpen(false);
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.categories(householdId),
        });
      }
    } else {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), -1);
      const { error } = await supabase.from("categories").insert({
        household_id: householdId,
        name: name.trim(),
        color,
        sort_order: maxOrder + 1,
      });
      if (error) toast.error(error.message);
      else {
        setName("");
        setOpen(false);
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.categories(householdId),
        });
        toast.success("Kategori skapad");
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!online) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    const supabase = createClient();
    await Promise.all(
      reordered.map((c, i) =>
        supabase.from("categories").update({ sort_order: i }).eq("id", c.id)
      )
    );
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.categories(householdId),
    });
  }

  function openCreate() {
    setEditCat(null);
    setName("");
    setColor(CATEGORY_COLORS[0]);
    setOpen(true);
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    setName(cat.name);
    setColor(cat.color);
    setOpen(true);
  }

  if (showQueryLoading(isLoading, categories)) {
    return <p className="text-sm text-muted-foreground">Laddar…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold">Kategorier</h1>
          {categories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {categories.length} st · dra för att sortera
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground active:opacity-90"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Ny
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editCat ? "Redigera" : "Ny kategori"}</DialogTitle>
            </DialogHeader>
            <CategoryForm
              name={name}
              color={color}
              onNameChange={setName}
              onColorChange={setColor}
              onSubmit={saveCategory}
            />
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Inga kategorier ännu
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="overflow-hidden rounded-xl border border-border/60 bg-card">
              {categories.map((cat) => (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  onEdit={() => openEdit(cat)}
                  onDelete={() => setDeleteCat(cat)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {deleteCat && (
        <DeleteCategoryDialog
          category={deleteCat}
          categories={categories.filter((c) => c.id !== deleteCat.id)}
          householdId={householdId}
          onClose={() => setDeleteCat(null)}
        />
      )}
    </div>
  );
}
