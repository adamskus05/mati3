"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, ShoppingCart } from "lucide-react";
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
import { fetchCategories } from "@/lib/queries/categories";
import { registerUndo } from "@/lib/undo/undo-action";
import { enqueueMutation } from "@/lib/offline/mutation-queue";
import { notifyPartnerPush } from "@/lib/push/notify-partner";
import { PartnerItemSignals } from "@/components/items/partner-item-signals";
import { findListDuplicate } from "@/lib/items/find-list-duplicate";
import {
  canMergeUnits,
  mergeItemNotes,
  mergeQuantities,
} from "@/lib/items/merge-export-ingredients";
import { DuplicateItemDialog } from "@/components/items/duplicate-item-dialog";
import type {
  Category,
  ItemPreset,
  ShoppingItemWithCompleter,
  ShoppingListWithCreator,
} from "@/lib/database.types";
import { ListAddToolbar } from "@/components/items/list-add-toolbar";
import { EmptyState } from "@/components/ui/empty-state";

const ItemFormDialog = dynamic(
  () =>
    import("@/components/items/item-form-dialog").then((m) => m.ItemFormDialog),
  { ssr: false }
);
import { CategorySection } from "@/components/items/category-section";
import {
  isShopperActive,
  ListShopperBar,
} from "@/components/items/list-shopper-bar";
import { ListFilters } from "@/components/items/list-filters";
import { BulkActionsBar } from "@/components/items/bulk-actions-bar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ShoppingListDetail({
  householdId,
  listId,
  userId,
  readOnly = false,
}: {
  householdId: string;
  listId: string;
  userId: string;
  readOnly?: boolean;
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
  const [addCategoryId, setAddCategoryId] = useState("none");
  const [editItem, setEditItem] = useState<ShoppingItemWithCompleter | null>(null);
  const [duplicatePending, setDuplicatePending] = useState<{
    name: string;
    match: ShoppingItemWithCompleter;
  } | null>(null);

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
    placeholderData: listFromCache,
    staleTime: 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: QUERY_KEYS.categories(householdId),
    queryFn: () => fetchCategories(createClient(), householdId),
    staleTime: 60_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.items(listId),
    queryFn: () => fetchListItems(createClient(), listId),
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

  useEffect(() => {
    const last = getLastCategoryId();
    setAddCategoryId(last ?? "none");
  }, [householdId]);

  function openAddForm(name = "") {
    setAddDraftName(name);
    setAddDraftCategory(addCategoryId);
    setAddOpen(true);
  }

  function pickAddCategory(id: string) {
    setAddCategoryId(id);
    setLastCategoryId(id === "none" ? null : id);
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
            ? {
                ...i,
                completed,
                sort_order,
                completed_at,
                completed_by,
                completer: completed
                  ? { display_name: "Du", email: "" }
                  : null,
              }
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

  function mergeIntoExisting(
    existing: ShoppingItemWithCompleter,
    incoming: {
      quantity: number | null;
      unit: string | null;
      notes: string | null;
    }
  ) {
    const quantity = mergeQuantities(existing.quantity, incoming.quantity);
    const notes = mergeItemNotes(existing.notes, incoming.notes);
    const payload = { quantity, notes };
    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId)
    );
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(
      QUERY_KEYS.items(listId),
      (old) =>
        old?.map((i) => (i.id === existing.id ? { ...i, ...payload } : i))
    );
    if (!online) {
      void enqueueMutation({
        type: "update_item",
        listId,
        itemId: existing.id,
        payload: {
          name: existing.name,
          category_id: existing.category_id,
          unit: existing.unit,
          ...payload,
        },
      });
      return;
    }
    void createClient()
      .from("shopping_items")
      .update(payload)
      .eq("id", existing.id)
      .then(({ error }) => {
        if (error) {
          toast.error(error.message);
          queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        }
      });
  }

  function quickAdd(name: string, skipDuplicateCheck = false) {
    if (readOnly) return;
    if (!skipDuplicateCheck) {
      const match = findListDuplicate(items, name, null);
      if (match) {
        const full = items.find((i) => i.id === match.id);
        if (full) {
          setDuplicatePending({ name, match: full });
          return;
        }
      }
    }
    executeQuickAdd(name);
  }

  function executeQuickAdd(name: string) {
    if (readOnly) return;
    const categoryId = addCategoryId === "none" ? null : addCategoryId;
    setLastCategoryId(categoryId);
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
      created_by: userId,
      completer: null,
      creator: { display_name: "Du", email: "" },
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
        clientId: tempId,
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
          created_by: userId,
        })
        .select(
          `
          *,
          completer:profiles!shopping_items_completed_by_fkey ( display_name, email ),
          creator:profiles!shopping_items_created_by_fkey ( display_name, email )
        `
        )
        .single();

      if (error) {
        toast.error(error.message);
        queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
        return;
      }

      queryClient.setQueryData<ShoppingItemWithCompleter[]>(
        QUERY_KEYS.items(listId),
        (old) =>
          old?.map((i) =>
            i.id === tempId ? (data as ShoppingItemWithCompleter) : i
          )
      );

      const listLabel = list?.name?.trim() || "listan";
      notifyPartnerPush({
        householdId,
        eventType: "list_items_added",
        body: `${name} lades till på ${listLabel}`,
        url: `/h/${householdId}/lists/${listId}`,
      });
    })();
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (readOnly || selectMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = filteredItems.find((i) => i.id === active.id);
    const overItem = filteredItems.find((i) => i.id === over.id);
    if (!activeItem || !overItem) return;
    if (activeItem.completed !== overItem.completed) return;
    if (activeItem.category_id !== overItem.category_id) return;

    const catId = activeItem.category_id ?? null;
    const groupItems = (grouped.get(catId) ?? []).filter(
      (i) => i.completed === activeItem.completed
    );

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

    const updates = reordered.map((item, index) => ({
      itemId: item.id,
      sort_order: index,
    }));

    if (!online) {
      void enqueueMutation({ type: "reorder_items", listId, updates });
      return;
    }

    const supabase = createClient();
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("shopping_items")
          .update({ sort_order: u.sort_order })
          .eq("id", u.itemId)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Kunde inte spara ordning");
      queryClient.setQueryData(QUERY_KEYS.items(listId), previous);
    }
  }

  function addFromPreset(preset: ItemPreset) {
    if (readOnly) return;
    if (preset.category_id) {
      setLastCategoryId(preset.category_id);
      setAddCategoryId(preset.category_id);
    }
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
    const ids = [...selectedIds];
    const itemsKey = QUERY_KEYS.items(listId);
    const previous = queryClient.getQueryData<ShoppingItemWithCompleter[]>(itemsKey);
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(itemsKey, (old) =>
      old?.map((item) =>
        ids.includes(item.id) ? { ...item, category_id: categoryId } : item
      )
    );
    setLastCategoryId(categoryId);
    setSelectedIds(new Set());
    setSelectMode(false);

    if (!online) {
      void enqueueMutation({
        type: "bulk_update_category",
        listId,
        itemIds: ids,
        category_id: categoryId,
      });
      return;
    }

    const { error } = await createClient()
      .from("shopping_items")
      .update({ category_id: categoryId })
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(itemsKey, previous);
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
      shopper: shopperId
        ? shopperId === userId
          ? { display_name: "Du", email: "" }
          : previous.shopper
        : null,
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
          return;
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(listId) });
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.lists(householdId),
        });
        const listLabel = list?.name?.trim() || "listan";
        notifyPartnerPush({
          householdId,
          eventType: "shopping_started",
          body: `Någon började handla: ${listLabel}`,
          url: `/h/${householdId}/lists/${listId}`,
        });
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
          return;
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(listId) });
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.lists(householdId),
        });
        const listLabel = list?.name?.trim() || "listan";
        notifyPartnerPush({
          householdId,
          eventType: "shopping_ended",
          body: `Någon slutade handla: ${listLabel}`,
          url: `/h/${householdId}/lists/${listId}`,
        });
      });
  }

  const itemsPending = isLoading && items.length === 0;

  return (
    <div className={cn("pb-4", readOnly ? "space-y-3" : "space-y-0")}>
      {!readOnly && <PartnerItemSignals items={items} userId={userId} />}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2",
          !readOnly && "border-b border-border/40 pb-2"
        )}
      >
        <Link
          href={
            readOnly
              ? `/h/${householdId}/settings?tab=history`
              : `/h/${householdId}`
          }
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md hover:bg-muted active:scale-95 active:bg-muted",
            readOnly ? "h-8 w-8" : "h-9 w-9"
          )}
        >
          <ArrowLeft className={readOnly ? "h-4 w-4" : "h-5 w-5"} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "truncate font-heading font-semibold leading-tight",
              readOnly ? "text-lg" : "text-[length:var(--mati-text-title)]"
            )}
          >
            {list?.name ?? "Lista"}
          </h1>
          {readOnly && (
            <p className="text-[11px] text-muted-foreground">
              Arkiverad – endast läsning
            </p>
          )}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            {!isShopperActive(list) && (
              <ListShopperBar
                list={list}
                userId={userId}
                onStart={startShopping}
                onStop={stopShopping}
              />
            )}
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
      </div>

      {!readOnly && isShopperActive(list) && (
        <div className="shrink-0 border-b border-border/40 py-1.5">
          <ListShopperBar
            list={list}
            userId={userId}
            onStart={startShopping}
            onStop={stopShopping}
          />
        </div>
      )}

      {!readOnly && (
        <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 py-2 backdrop-blur-sm">
          <ListAddToolbar
            categories={categories}
            categoryId={addCategoryId}
            onCategoryChange={pickAddCategory}
            onQuickAdd={quickAdd}
            onOpenForm={(prefill) => openAddForm(prefill ?? "")}
            presets={presets}
            onPresetSelect={addFromPreset}
          />
        </div>
      )}

      <div className={cn(!readOnly && "pt-3", readOnly && "space-y-2")}>
        {itemsPending ? (
          <ListItemsSkeleton compact={readOnly} />
        ) : (
          <div className={readOnly ? "space-y-2" : "space-y-2"}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {categoryOrder.map((category) => {
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
                    onToggle={toggleComplete}
                    onEdit={setEditItem}
                    onDelete={deleteItem}
                  />
                );
              })}
            </DndContext>
          </div>
        )}

        {!itemsPending && filteredItems.length === 0 && (
          search || hideCompleted ? (
            <p
              className={cn(
                "text-center text-muted-foreground",
                readOnly ? "py-4 text-sm" : "py-12 text-sm"
              )}
            >
              Inga träffar
            </p>
          ) : readOnly ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Listan är tom
            </p>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="Listan är tom"
              description="Lägg till varor ni ska handla."
              primaryAction={{
                label: "Lägg till vara",
                onClick: () => setAddOpen(true),
              }}
            />
          )
        )}
      </div>

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
          <DuplicateItemDialog
            open={duplicatePending !== null}
            itemName={duplicatePending?.name ?? ""}
            existingName={duplicatePending?.match.name ?? ""}
            canMerge={
              duplicatePending
                ? canMergeUnits(duplicatePending.match.unit, null)
                : false
            }
            onOpenChange={(open) => {
              if (!open) setDuplicatePending(null);
            }}
            onAddAnyway={() => {
              if (!duplicatePending) return;
              const { name } = duplicatePending;
              setDuplicatePending(null);
              executeQuickAdd(name);
            }}
            onMerge={() => {
              if (!duplicatePending) return;
              const { name, match } = duplicatePending;
              setDuplicatePending(null);
              mergeIntoExisting(match, {
                quantity: null,
                unit: null,
                notes: name.trim() !== match.name.trim() ? name : null,
              });
              toast.success("Slaget ihop med befintlig vara");
            }}
          />
          <ItemFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            listId={listId}
            listItems={items}
            categories={categories}
            initialName={addDraftName}
            initialCategoryId={addDraftCategory}
            onSuccess={(savedCategoryId) => {
              setLastCategoryId(savedCategoryId);
              setAddCategoryId(savedCategoryId ?? "none");
              setAddOpen(false);
              setAddDraftName("");
            }}
          />
          <ItemFormDialog
            open={!!editItem}
            onOpenChange={(o) => !o && setEditItem(null)}
            listId={listId}
            listItems={items}
            categories={categories}
            item={editItem ?? undefined}
            onSuccess={() => setEditItem(null)}
          />
        </>
      )}
    </div>
  );
}
