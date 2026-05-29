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
import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("rounded-2xl", isDragging && "shadow-lg opacity-90")}
    >
      <CardContent className="flex items-center gap-3 py-3">
        <button type="button" className="touch-none" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span
          className="h-8 w-8 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="flex-1 font-medium">{category.name}</span>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardContent>
    </Card>
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
    return <p className="text-muted-foreground">Laddar…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Kategorier</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Ny
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editCat ? "Redigera" : "Ny kategori"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveCategory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="catName">Namn</Label>
                <Input
                  id="catName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Färg</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full ring-2 ring-offset-2 transition-all",
                        color === c ? "ring-primary" : "ring-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-full"
                />
              </div>
              <Button type="submit" className="w-full">
                Spara
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {categories.map((cat) => (
              <li key={cat.id}>
                <SortableCategory
                  category={cat}
                  onEdit={() => openEdit(cat)}
                  onDelete={() => setDeleteCat(cat)}
                />
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {categories.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Inga kategorier ännu
        </p>
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
