"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";
import {
  getNextSortOrder,
  getNextSortOrderFromItems,
  groupItemsByCategory,
} from "@/lib/items/sort-order";
import { showQueryLoading } from "@/lib/query/loading";
import { useListItemsRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import type { Category, ShoppingItem, ItemPreset } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemFormDialog } from "@/components/items/item-form-dialog";
import { PresetChips } from "@/components/items/preset-chips";
import { CategorySection } from "@/components/items/category-section";
import { toast } from "sonner";

export function ShoppingListDetail({
  householdId,
  listId,
  readOnly = false,
}: {
  householdId: string;
  listId: string;
  readOnly?: boolean;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);

  useListItemsRealtime(listId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: list } = useQuery({
    queryKey: QUERY_KEYS.list(listId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("shopping_lists")
        .select("*")
        .eq("id", listId)
        .single();
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
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

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.items(listId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("shopping_items")
        .select("*")
        .eq("shopping_list_id", listId);
      return data ?? [];
    },
  });

  const { data: presets = [] } = useQuery({
    queryKey: QUERY_KEYS.presets(householdId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("item_presets")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !readOnly,
  });

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.notes?.toLowerCase().includes(q) ?? false)
    );
  }, [items, search]);

  const grouped = useMemo(
    () => groupItemsByCategory(filteredItems),
    [filteredItems]
  );

  const categoryOrder = useMemo(() => {
    const ordered: (Category | null)[] = categories.map((c) => c);
    if (grouped.has(null)) ordered.push(null);
    return ordered;
  }, [categories, grouped]);

  function toggleComplete(item: ShoppingItem) {
    if (!online || readOnly) {
      if (!online) toast.error("Ingen anslutning");
      return;
    }
    const completed = !item.completed;
    const current =
      queryClient.getQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId)) ?? items;
    const sort_order = getNextSortOrderFromItems(
      current,
      item.category_id,
      completed
    );

    const previous = queryClient.getQueryData<ShoppingItem[]>(
      QUERY_KEYS.items(listId)
    );

    queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
      old?.map((i) =>
        i.id === item.id ? { ...i, completed, sort_order } : i
      )
    );

    void (async () => {
      const supabase = createClient();
      let finalOrder = sort_order;
      try {
        finalOrder = await getNextSortOrder(
          supabase,
          listId,
          item.category_id,
          completed
        );
        if (finalOrder !== sort_order) {
          queryClient.setQueryData<ShoppingItem[]>(
            QUERY_KEYS.items(listId),
            (old) =>
              old?.map((i) =>
                i.id === item.id ? { ...i, sort_order: finalOrder } : i
              )
          );
        }
      } catch {
        /* keep optimistic sort_order */
      }

      const { error } = await supabase
        .from("shopping_items")
        .update({ completed, sort_order: finalOrder })
        .eq("id", item.id);

      if (error) {
        toast.error(error.message);
        queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
      }
    })();
  }

  function deleteItem(id: string) {
    if (!online || readOnly) return;
    const previous = queryClient.getQueryData<ShoppingItem[]>(
      QUERY_KEYS.items(listId)
    );
    queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
      old?.filter((i) => i.id !== id)
    );
    void createClient()
      .from("shopping_items")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        }
      });
  }

  async function handleDragEnd(
    event: DragEndEvent,
    categoryId: string | null,
    groupItems: ShoppingItem[]
  ) {
    if (readOnly || !online) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = groupItems.find((i) => i.id === active.id);
    const overItem = groupItems.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    if (activeItem.completed !== overItem.completed) return;

    const oldIndex = groupItems.findIndex((i) => i.id === active.id);
    const newIndex = groupItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(groupItems, oldIndex, newIndex);
    const previous = queryClient.getQueryData<ShoppingItem[]>(
      QUERY_KEYS.items(listId)
    );
    const orderMap = new Map(reordered.map((item, index) => [item.id, index]));

    queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
      old?.map((i) =>
        orderMap.has(i.id) ? { ...i, sort_order: orderMap.get(i.id)! } : i
      )
    );

    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((item, index) =>
        supabase
          .from("shopping_items")
          .update({ sort_order: index })
          .eq("id", item.id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Kunde inte spara ordning");
      queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
    }
  }

  function addFromPreset(preset: ItemPreset) {
    if (!online || readOnly) {
      toast.error("Ingen anslutning");
      return;
    }
    const current =
      queryClient.getQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId)) ?? items;
    const sort_order = getNextSortOrderFromItems(
      current,
      preset.category_id,
      false
    );
    const tempId = `optimistic-${crypto.randomUUID()}`;
    const optimistic: ShoppingItem = {
      id: tempId,
      shopping_list_id: listId,
      name: preset.name,
      quantity: preset.default_quantity,
      unit: preset.default_unit,
      category_id: preset.category_id,
      sort_order,
      completed: false,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) => [
      ...(old ?? []),
      optimistic,
    ]);
    toast.success(`${preset.name} tillagd`);

    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shopping_items")
        .insert({
          shopping_list_id: listId,
          name: preset.name,
          quantity: preset.default_quantity,
          unit: preset.default_unit,
          category_id: preset.category_id,
          sort_order,
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
        queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
          old?.filter((i) => i.id !== tempId)
        );
        return;
      }

      queryClient.setQueryData<ShoppingItem[]>(QUERY_KEYS.items(listId), (old) =>
        old?.map((i) => (i.id === tempId ? data : i))
      );
    })();
  }

  if (showQueryLoading(isLoading, items)) {
    return <p className="text-muted-foreground">Laddar…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={readOnly ? `/h/${householdId}/history` : `/h/${householdId}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted active:scale-95 active:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-semibold truncate">
            {list?.name ?? "Lista"}
          </h1>
          {readOnly && (
            <p className="text-xs text-muted-foreground">Arkiverad – endast läsning</p>
          )}
        </div>
        {!readOnly && (
          <Button size="sm" className="rounded-xl gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Vara
          </Button>
        )}
      </div>

      {!readOnly && presets.length > 0 && (
        <PresetChips presets={presets} onSelect={addFromPreset} />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Sök varor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl pl-9"
        />
      </div>

      {categoryOrder.map((category) => {
        const catId = category?.id ?? null;
        const groupItems = grouped.get(catId) ?? [];
        if (groupItems.length === 0 && search) return null;

        return (
          <CategorySection
            key={catId ?? "uncategorized"}
            category={category}
            items={groupItems}
            readOnly={readOnly}
            sensors={sensors}
            onToggle={toggleComplete}
            onEdit={setEditItem}
            onDelete={deleteItem}
            onDragEnd={(e) => handleDragEnd(e, catId, groupItems)}
          />
        );
      })}

      {filteredItems.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {search ? "Inga träffar" : "Listan är tom"}
        </p>
      )}

      {!readOnly && (
        <>
          <ItemFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            listId={listId}
            categories={categories}
            onSuccess={() => setAddOpen(false)}
          />
          <ItemFormDialog
            open={!!editItem}
            onOpenChange={(o) => !o && setEditItem(null)}
            listId={listId}
            categories={categories}
            item={editItem ?? undefined}
            onSuccess={() => setEditItem(null)}
          />
        </>
      )}
    </div>
  );
}
