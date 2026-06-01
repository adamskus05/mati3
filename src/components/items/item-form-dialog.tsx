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
import {
  enqueueMutation,
  isPendingSyncItemId,
} from "@/lib/offline/mutation-queue";
import { findListDuplicate } from "@/lib/items/find-list-duplicate";
import {
  canMergeUnits,
  mergeItemNotes,
  mergeQuantities,
} from "@/lib/items/merge-export-ingredients";
import { DuplicateItemDialog } from "@/components/items/duplicate-item-dialog";
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
  listItems,
  categories,
  item,
  initialName = "",
  initialCategoryId = "none",
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listItems: ShoppingItemWithCompleter[];
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
  const [duplicatePending, setDuplicatePending] = useState<{
    payload: {
      name: string;
      quantity: number | null;
      unit: string | null;
      category_id: string | null;
      notes: string | null;
    };
    match: ShoppingItemWithCompleter;
  } | null>(null);

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

  function mergeIntoExisting(
    existing: ShoppingItemWithCompleter,
    incoming: {
      name: string;
      quantity: number | null;
      unit: string | null;
      category_id: string | null;
      notes: string | null;
    }
  ) {
    const mergedQty = mergeQuantities(existing.quantity, incoming.quantity);
    const mergedNotes = mergeItemNotes(existing.notes, incoming.notes);
    const updatePayload = {
      name: existing.name,
      category_id: existing.category_id,
      quantity: mergedQty,
      unit: existing.unit,
      notes: mergedNotes,
    };
    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) =>
        old?.map((i) =>
          i.id === existing.id ? { ...i, ...updatePayload } : i
        )
    );
    onOpenChange(false);
    onSuccess(existing.category_id);
    if (!online) {
      void enqueueMutation({
        type: "update_item",
        listId,
        itemId: existing.id,
        payload: updatePayload,
      });
      toast.success("Slaget ihop med befintlig vara");
      return;
    }
    void createClient()
      .from("shopping_items")
      .update({ quantity: mergedQty, notes: mergedNotes })
      .eq("id", existing.id)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        } else {
          toast.success("Slaget ihop med befintlig vara");
        }
      });
  }

  function commitCreate(
    payload: {
      name: string;
      quantity: number | null;
      unit: string | null;
      category_id: string | null;
      notes: string | null;
    },
    skipDuplicateCheck = false
  ) {
    if (!skipDuplicateCheck) {
      const match = findListDuplicate(listItems, payload.name, payload.unit);
      if (match) {
        const full = listItems.find((i) => i.id === match.id);
        if (full) {
          setDuplicatePending({ payload, match: full });
          setLoading(false);
          return;
        }
      }
    }

    const cached =
      queryClient.getQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId)
      ) ?? [];
    const sort_order = getNextSortOrderFromItems(cached, payload.category_id, false);
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
    const previous = cached;
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) => [...(old ?? []), optimistic]
    );
    onOpenChange(false);

    if (!online) {
      setLoading(false);
      void enqueueMutation({
        type: "add_item",
        listId,
        clientId: tempId,
        payload: { ...payload, sort_order },
      });
      onSuccess(payload.category_id);
      return;
    }

    void createClient()
      .from("shopping_items")
      .insert({
        shopping_list_id: listId,
        ...payload,
        sort_order,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast.error(error.message);
          queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        } else if (data) {
          queryClient.setQueryData<ShoppingItemWithCompleter[]>(
            QUERY_KEYS.items(listId),
            (old) =>
              old?.map((i) =>
                i.id === tempId ? { ...data, completer: null } : i
              )
          );
          onSuccess(payload.category_id);
        }
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (item && isPendingSyncItemId(item.id) && !online) {
      toast.error("Varan synkas fortfarande – försök igen om en stund");
      return;
    }

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

      if (!online) {
        setLoading(false);
        void enqueueMutation({
          type: "update_item",
          listId,
          itemId: item.id,
          payload,
        });
        onSuccess(catId);
        return;
      }

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
      commitCreate(payload);
    }
  }

  if (!open) return null;

  return (
    <>
      <DuplicateItemDialog
        open={duplicatePending !== null}
        itemName={duplicatePending?.payload.name ?? ""}
        existingName={duplicatePending?.match.name ?? ""}
        canMerge={
          duplicatePending
            ? canMergeUnits(
                duplicatePending.match.unit,
                duplicatePending.payload.unit
              )
            : false
        }
        onOpenChange={(o) => {
          if (!o) setDuplicatePending(null);
        }}
        onAddAnyway={() => {
          if (!duplicatePending) return;
          const { payload } = duplicatePending;
          setDuplicatePending(null);
          setLoading(true);
          commitCreate(payload, true);
        }}
        onMerge={() => {
          if (!duplicatePending) return;
          const { payload, match } = duplicatePending;
          setDuplicatePending(null);
          setLoading(false);
          mergeIntoExisting(match, payload);
        }}
      />
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(88dvh,560px)] flex-col rounded-t-2xl px-0 pb-0"
      >
        <SheetHeader className="border-b border-border/60 px-4 pb-2 text-left">
          <SheetTitle className="font-heading text-[length:var(--mati-text-title)]">
            {item ? "Redigera vara" : "Lägg till vara"}
          </SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="itemName" className="text-xs text-muted-foreground">
                Namn
              </Label>
              <Input
                id="itemName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Mjölk"
                required
                autoFocus
                className="mati-input h-[var(--mati-touch)] rounded-xl border-0 bg-muted/60 text-[length:var(--mati-text-input)] font-medium shadow-none focus-visible:ring-2"
              />
            </div>

            <CategoryPicker
              variant="scroll"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />

            <div className="rounded-xl border border-border/60 bg-muted/20">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
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
                        className="h-[var(--mati-touch)] rounded-xl"
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

          <div className="sticky bottom-0 border-t border-border/60 bg-background p-3 pb-3">
            <Button
              type="submit"
              className="h-[var(--mati-touch)] w-full rounded-xl"
              disabled={loading || !name.trim()}
            >
              {loading ? "Sparar…" : item ? "Spara" : "Lägg till"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
    </>
  );
}
