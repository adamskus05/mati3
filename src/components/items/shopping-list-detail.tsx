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
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS, LAST_CATEGORY_KEY } from "@/lib/constants";
import {
  getNextSortOrderFromItems,
  groupItemsByCategory,
} from "@/lib/items/sort-order";
import { useListItemsRealtime } from "@/hooks/use-realtime";
import { ListItemsSkeleton } from "@/components/items/list-items-skeleton";
import { useOnline } from "@/hooks/use-online";
import { fetchListItems } from "@/lib/queries/items";
import { fetchList } from "@/lib/queries/lists";
import { registerUndo } from "@/lib/undo/undo-action";
import { enqueueMutation } from "@/lib/offline/mutation-queue";
import type {
  Category,
  ItemPreset,
  ShoppingItemWithCompleter,
  ShoppingListWithCreator,
} from "@/lib/database.types";
import { ItemFormDialog } from "@/components/items/item-form-dialog";
import { ListAddBar } from "@/components/items/list-add-bar";
import { PresetChips } from "@/components/items/preset-chips";
import { CategorySection } from "@/components/items/category-section";
import { ListShopperBar } from "@/components/items/list-shopper-bar";
import { ListFilters } from "@/components/items/list-filters";
import { BulkActionsBar } from "@/components/items/bulk-actions-bar";
import { toast } from "sonner";

export function ShoppingListDetail({
  householdId,
  listId,
  userId,
  readOnly = false,
  initialList,
  initialItems,
  initialCategories,
}: {
  householdId: string;
  listId: string;
  userId: string;
  readOnly?: boolean;
  initialList?: ShoppingListWithCreator;
  initialItems?: ShoppingItemWithCompleter[];
  initialCategories?: Category[];
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addDraftName, setAddDraftName] = useState("");
  const [addDraftCategory, setAddDraftCategory] = useState("none");
  const [editItem, setEditItem] = useState<ShoppingItemWithCompleter | null>(null);

  useListItemsRealtime(listId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const listFromCache = useMemo(() => {
    const lists = queryClient.getQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId)
    );
    return lists?.find((l) => l.id === listId);
  }, [queryClient, householdId, listId]);

  const { data: list } = useQuery({
    queryKey: QUERY_KEYS.list(listId),
    queryFn: () => fetchList(createClient(), listId),
    initialData: initialList ?? listFromCache,
    staleTime: 60_000,
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
    initialData: initialCategories,
    staleTime: 60_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.items(listId),
    queryFn: () => fetchListItems(createClient(), listId),
    initialData: initialItems,
    staleTime: 30_000,
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
    let result = items;
    if (hideCompleted) result = result.filter((i) => !i.completed);
    if (categoryFilter !== null) {
      result = result.filter((i) => i.category_id === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [items, search, hideCompleted, categoryFilter]);

  const grouped = useMemo(
    () => groupItemsByCategory(filteredItems),
    [filteredItems]
  );

  const categoryOrder = useMemo(() => {
    const ordered: (Category | null)[] = categories.map((c) => c);
    if (grouped.has(null)) ordered.push(null);
    return ordered;
  }, [categories, grouped]);

  function getLastCategoryId(): string | null {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(LAST_CATEGORY_KEY(householdId));
    return v === "none" || !v ? null : v;
  }

  function setLastCategoryId(catId: string | null) {
    localStorage.setItem(
      LAST_CATEGORY_KEY(householdId),
      catId ?? "none"
    );
  }

  function openAddForm(name = "") {
    const last = getLastCategoryId();
    setAddDraftName(name);
    setAddDraftCategory(last ?? "none");
    setAddOpen(true);
  }

  function toggleComplete(item: ShoppingItemWithCompleter) {
    if (readOnly) return;
    const completed = !item.completed;
    const current =
      queryClient.getQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId)
      ) ?? items;
    const sort_order = getNextSortOrderFromItems(
      current,
      item.category_id,
      completed
    );
    const completed_at = completed ? new Date().toISOString() : null;
    const completed_by = completed ? userId : null;

    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );

    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) =>
        old?.map((i) =>
          i.id === item.id
            ? { ...i, completed, sort_order, completed_at, completed_by }
            : i
        )
    );

    registerUndo({
      label: completed ? "Vara avbockad" : "Vara återställd",
      undo: () => queryClient.setQueryData(QUERY_KEYS.items(listId), previous),
    });

    if (!online) {
      void enqueueMutation({
        type: "toggle_item",
        listId,
        itemId: item.id,
        completed,
        sort_order,
        completed_by,
        completed_at,
      });
      return;
    }

    void createClient()
      .from("shopping_items")
      .update({
        completed,
        sort_order,
        completed_by,
        completed_at,
      })
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        }
      });
  }

  function deleteItem(id: string) {
    if (readOnly) return;
    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );
    const removed = previous?.find((i) => i.id === id);
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) => old?.filter((i) => i.id !== id)
    );

    if (removed) {
      registerUndo({
        label: "Vara borttagen",
        undo: () => queryClient.setQueryData(QUERY_KEYS.items(listId), previous),
      });
    }

    if (!online) {
      void enqueueMutation({ type: "delete_item", listId, itemId: id });
      return;
    }

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

  function quickAdd(name: string) {
    if (readOnly) return;
    const categoryId = getLastCategoryId();
    const current =
      queryClient.getQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId)
      ) ?? items;
    const sort_order = getNextSortOrderFromItems(current, categoryId, false);
    const tempId = `optimistic-${crypto.randomUUID()}`;
    const optimistic: ShoppingItemWithCompleter = {
      id: tempId,
      shopping_list_id: listId,
      name,
      quantity: null,
      unit: null,
      category_id: categoryId,
      sort_order,
      completed: false,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_by: null,
      completed_at: null,
      completer: null,
    };

    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );

    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) => [...(old ?? []), optimistic]
    );

    registerUndo({
      label: `${name} tillagd`,
      undo: () => queryClient.setQueryData(QUERY_KEYS.items(listId), previous),
    });

    if (!online) {
      void enqueueMutation({
        type: "add_item",
        listId,
        payload: { name, category_id: categoryId, sort_order },
      });
      return;
    }

    void (async () => {
      const { data, error } = await createClient()
        .from("shopping_items")
        .insert({
          shopping_list_id: listId,
          name,
          category_id: categoryId,
          sort_order,
        })
        .select(`*, completer:profiles!shopping_items_completed_by_fkey ( display_name, email )`)
        .single();

      if (error) {
        toast.error(error.message);
        queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        return;
      }

      const completer = null;
      queryClient.setQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId),
        (old) =>
          old?.map((i) =>
            i.id === tempId ? { ...data, completer } as ShoppingItemWithCompleter : i
          )
      );
    })();
  }

  async function handleDragEnd(
    event: DragEndEvent,
    groupItems: ShoppingItemWithCompleter[]
  ) {
    if (readOnly || !online || selectMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = groupItems.find((i) => i.id === active.id);
    const overItem = groupItems.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    if (activeItem.completed !== overItem.completed) return;

    const oldIndex = groupItems.findIndex((i) => i.id === active.id);
    const newIndex = groupItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(groupItems, oldIndex, newIndex);
    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );
    const orderMap = new Map(reordered.map((item, index) => [item.id, index]));

    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) =>
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
    if (readOnly) return;
    if (preset.category_id) setLastCategoryId(preset.category_id);
    quickAdd(preset.name);
  }

  async function bulkComplete() {
    const ids = [...selectedIds];
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (item && !item.completed) toggleComplete(item);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function bulkDelete() {
    for (const id of selectedIds) deleteItem(id);
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function bulkMoveCategory(categoryId: string | null) {
    if (!online) {
      toast.error("Kräver anslutning");
      return;
    }
    const ids = [...selectedIds];
    const { error } = await createClient()
      .from("shopping_items")
      .update({ category_id: categoryId })
      .in("id", ids);
    if (error) toast.error(error.message);
    else {
      setLastCategoryId(categoryId);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.items(listId) });
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  }

  function patchListShopper(shopperId: string | null, startedAt: string | null) {
    const previous = queryClient.getQueryData<ShoppingListWithCreator>(
      QUERY_KEYS.list(listId)
    );
    if (!previous) return undefined;
    queryClient.setQueryData<ShoppingListWithCreator>(QUERY_KEYS.list(listId), {
      ...previous,
      shopper_id: shopperId,
      shopper_started_at: startedAt,
      shopper: shopperId ? previous.shopper : null,
    });
    return previous;
  }

  function startShopping() {
    const previous = patchListShopper(userId, new Date().toISOString());
    void createClient()
      .rpc("set_list_shopper", { p_list_id: listId })
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          if (previous) {
            queryClient.setQueryData(QUERY_KEYS.list(listId), previous);
          }
        }
      });
  }

  function stopShopping() {
    const previous = patchListShopper(null, null);
    void createClient()
      .rpc("clear_list_shopper", { p_list_id: listId })
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          if (previous) {
            queryClient.setQueryData(QUERY_KEYS.list(listId), previous);
          }
        }
      });
  }

  const itemsPending = isLoading && items.length === 0;

  return (
    <div className="space-y-4 pb-4">
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
      </div>

      {!readOnly && (
        <ListShopperBar
          list={list}
          userId={userId}
          onStart={startShopping}
          onStop={stopShopping}
        />
      )}

      {!readOnly && presets.length > 0 && (
        <PresetChips presets={presets} onSelect={addFromPreset} />
      )}

      {!readOnly && (
        <ListAddBar
          onAddWithName={openAddForm}
          onOpenForm={() => openAddForm()}
          disabled={readOnly}
        />
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <ListFilters
            search={search}
            onSearchChange={setSearch}
            hideCompleted={hideCompleted}
            onHideCompletedChange={setHideCompleted}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            selectMode={selectMode}
            onSelectModeChange={(v) => {
              setSelectMode(v);
              if (!v) setSelectedIds(new Set());
            }}
          />
        </div>
      )}

      {itemsPending ? (
        <ListItemsSkeleton />
      ) : (
        categoryOrder.map((category) => {
        const catId = category?.id ?? null;
        if (categoryFilter !== null && catId !== categoryFilter) return null;
        const groupItems = grouped.get(catId) ?? [];
        if (groupItems.length === 0 && (search || hideCompleted)) return null;

        return (
          <CategorySection
            key={catId ?? "uncategorized"}
            category={category}
            items={groupItems}
            readOnly={readOnly}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onSelectToggle={(id) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            sensors={sensors}
            onToggle={toggleComplete}
            onEdit={setEditItem}
            onDelete={deleteItem}
            onDragEnd={(e) => handleDragEnd(e, groupItems)}
          />
        );
      })
      )}

      {!itemsPending && filteredItems.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          {search || hideCompleted ? "Inga träffar" : "Listan är tom"}
        </p>
      )}

      {selectMode && selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          categories={categories}
          onComplete={bulkComplete}
          onDelete={bulkDelete}
          onMoveCategory={bulkMoveCategory}
          onCancel={() => {
            setSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      {!readOnly && (
        <>
          <ItemFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            listId={listId}
            categories={categories}
            initialName={addDraftName}
            initialCategoryId={addDraftCategory}
            onSuccess={(savedCategoryId) => {
              setLastCategoryId(savedCategoryId);
              setAddOpen(false);
              setAddDraftName("");
            }}
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
