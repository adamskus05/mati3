"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getNextSortOrderFromItems } from "@/lib/items/sort-order";
import { QUERY_KEYS } from "@/lib/constants";
import { UNITS } from "@/lib/constants";
import type { Category, ShoppingItem } from "@/lib/database.types";
import { CategoryPicker } from "@/components/categories/category-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";

export function ItemFormDialog({
  open,
  onOpenChange,
  listId,
  categories,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  categories: Category[];
  item?: ShoppingItem;
  onSuccess: () => void;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("st");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity?.toString() ?? "");
      setUnit(item.unit ?? "st");
      setCategoryId(item.category_id ?? "none");
      setNotes(item.notes ?? "");
    } else {
      setName("");
      setQuantity("");
      setUnit("st");
      setCategoryId("none");
      setNotes("");
    }
  }, [item, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!name.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const catId = categoryId === "none" ? null : categoryId;
    const payload = {
      name: name.trim(),
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      category_id: catId,
      notes: notes.trim() || null,
    };

    const cached =
      queryClient.getQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId)) ?? [];

    if (item) {
      const previous = cached;
      queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
        old?.map((i) => (i.id === item.id ? { ...i, ...payload } : i))
      );
      const { error } = await supabase
        .from("shopping_items")
        .update(payload)
        .eq("id", item.id);
      setLoading(false);
      if (error) {
        toast.error(error.message);
        queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
      } else onSuccess();
    } else {
      const sort_order = getNextSortOrderFromItems(cached, catId, false);
      const { data, error } = await supabase
        .from("shopping_items")
        .insert({
          shopping_list_id: listId,
          ...payload,
          sort_order,
        })
        .select()
        .single();
      setLoading(false);
      if (error) toast.error(error.message);
      else if (data) {
        queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) => [
          ...(old ?? []),
          data,
        ]);
        onSuccess();
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Redigera vara" : "Lägg till vara"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemName">Namn</Label>
            <Input
              id="itemName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mjölk"
              required
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Antal</Label>
              <Input
                id="qty"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Enhet</Label>
              <div className="flex flex-wrap gap-1.5">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                      unit === u
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
          <div className="space-y-2">
            <Label htmlFor="notes">Kommentar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {item ? "Spara" : "Lägg till"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
