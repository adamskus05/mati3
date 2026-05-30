"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNextSortOrderFromItems } from "@/lib/items/sort-order";
import { QUERY_KEYS, UNITS } from "@/lib/constants";
import type {
  Category,
  ShoppingItem,
  ShoppingItemWithCompleter,
} from "@/lib/database.types";
import { CategoryPicker } from "@/components/categories/category-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  initialName = "",
  initialCategoryId = "none",
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  categories: Category[];
  item?: ShoppingItem;
  initialName?: string;
  initialCategoryId?: string;
  onSuccess: (savedCategoryId: string | null) => void;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("st");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity?.toString() ?? "");
      setUnit(item.unit ?? "st");
      setCategoryId(item.category_id ?? "none");
      setNotes(item.notes ?? "");
      setShowExtras(
        Boolean(
          item.quantity ?? (item.notes?.trim() || item.unit !== "st")
        )
      );
    } else {
      setName(initialName);
      setQuantity("");
      setUnit("st");
      setCategoryId(initialCategoryId);
      setNotes("");
      setShowExtras(false);
    }
  }, [item, open, initialName, initialCategoryId]);

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
      queryClient.getQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId)
      ) ?? [];

    if (item) {
      const previous = cached;
      queryClient.setQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId),
        (old) => old?.map((i) => (i.id === item.id ? { ...i, ...payload } : i))
      );
      const { error } = await supabase
        .from("shopping_items")
        .update(payload)
        .eq("id", item.id);
      setLoading(false);
      if (error) {
        toast.error(error.message);
        queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
      } else onSuccess(catId);
    } else {
      const sort_order = getNextSortOrderFromItems(cached, catId, false);
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const optimistic = {
        id: tempId,
        shopping_list_id: listId,
        ...payload,
        completed: false,
        sort_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_by: null,
        completed_at: null,
        completer: null,
      } as ShoppingItemWithCompleter;
      queryClient.setQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId),
        (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      onOpenChange(false);

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
      if (error) {
        toast.error(error.message);
        queryClient.setQueryData<ShoppingItemWithCompleter[]>(
          QUERY_KEYS.items(listId),
          (old) => old?.filter((i) => i.id !== tempId)
        );
      } else if (data) {
        queryClient.setQueryData<ShoppingItemWithCompleter[]>(
          QUERY_KEYS.items(listId),
          (old) =>
            old?.map((i) =>
              i.id === tempId ? { ...data, completer: null } : i
            )
        );
        onSuccess(catId);
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(92dvh,640px)] flex-col rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-3 text-left">
          <SheetTitle className="font-heading text-xl">
            {item ? "Redigera vara" : "Lägg till vara"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-5 px-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="itemName" className="text-xs text-muted-foreground">
                Vad ska köpas?
              </Label>
              <Input
                id="itemName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Mjölk"
                required
                autoFocus
                className="h-12 rounded-xl border-0 bg-muted/60 text-lg font-medium shadow-none focus-visible:ring-2"
              />
            </div>

            <CategoryPicker
              variant="inline"
              layout="grid"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />

            <div className="rounded-xl border border-border/60 bg-muted/20">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-3 text-sm font-medium"
                onClick={() => setShowExtras((v) => !v)}
              >
                Antal & kommentar
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    showExtras && "rotate-180"
                  )}
                />
              </button>
              {showExtras && (
                <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="qty" className="text-xs text-muted-foreground">
                        Antal
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="–"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Enhet</Label>
                      <div className="flex flex-wrap gap-1">
                        {UNITS.slice(0, 4).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setUnit(u)}
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-medium",
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
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs text-muted-foreground">
                      Kommentar
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Valfritt"
                      className="resize-none rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-border/60 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base"
              disabled={loading || !name.trim()}
            >
              {loading ? "Sparar…" : item ? "Spara ändringar" : "Lägg till i listan"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
