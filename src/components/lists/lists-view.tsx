"use client";

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
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveLists } from "@/lib/queries/lists";
import {
  LIST_SORT_STORAGE_KEY,
  QUERY_KEYS,
  type ListSortMode,
} from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import { registerUndo } from "@/lib/undo/undo-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, ChevronRight, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { profileDisplayName } from "@/lib/profiles/display-name";
import { ListsSkeleton } from "@/components/lists/lists-skeleton";
import type { ShoppingListWithCreator } from "@/lib/database.types";
import { ListSortMenu } from "@/components/lists/list-sort-menu";
import { cn } from "@/lib/utils";
import { prefetchListDetail } from "@/lib/query/prefetch-list-detail";
import { isStandalonePwa } from "@/lib/pwa/standalone";

function SortableListRow({
  list,
  householdId,
  onEdit,
  onDelete,
  dragEnabled,
  onWarm,
}: {
  list: ShoppingListWithCreator;
  householdId: string;
  onEdit: () => void;
  onDelete: () => void;
  dragEnabled: boolean;
  onWarm: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, disabled: !dragEnabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-0.5 overflow-hidden rounded-xl border border-border/60 bg-card",
        isDragging && "z-10 shadow-md ring-1 ring-border"
      )}
    >
      {dragEnabled && (
        <button
          type="button"
          className="touch-none shrink-0 self-stretch px-1.5 text-muted-foreground active:opacity-60"
          aria-label="Flytta lista"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Link
        href={`/h/${householdId}/lists/${list.id}`}
        prefetch
        onPointerEnter={onWarm}
        onTouchStart={onWarm}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 pr-1 transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{list.name}</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {profileDisplayName(list.creator)} ·{" "}
            {new Date(list.updated_at).toLocaleDateString("sv-SE", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/80" />
      </Link>
      <div className="flex shrink-0 pr-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          onClick={onEdit}
          aria-label={`Redigera ${list.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Ta bort ${list.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function ListsView({ householdId }: { householdId: string }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [sortMode, setSortMode] = useState<ListSortMode>("manual");
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(
      LIST_SORT_STORAGE_KEY(householdId)
    ) as ListSortMode | null;
    if (stored === "manual" || stored === "updated" || stored === "name") {
      setSortMode(stored);
    }
  }, [householdId]);

  useHouseholdRealtime(householdId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: lists = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.lists(householdId),
    queryFn: () => fetchActiveLists(createClient(), householdId),
    staleTime: 60_000,
  });

  const sortedLists = useMemo(() => {
    const copy = [...lists];
    if (sortMode === "name") {
      copy.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    } else if (sortMode === "updated") {
      copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      copy.sort((a, b) => a.sort_order - b.sort_order);
    }
    return copy;
  }, [lists, sortMode]);

  function warmList(listId: string) {
    prefetchListDetail(queryClient, householdId, listId);
  }

  useEffect(() => {
    if (isStandalonePwa()) return;
    for (const list of sortedLists.slice(0, 4)) {
      prefetchListDetail(queryClient, householdId, list.id);
    }
  }, [householdId, sortedLists, queryClient]);

  function changeSortMode(mode: ListSortMode) {
    setSortMode(mode);
    localStorage.setItem(LIST_SORT_STORAGE_KEY(householdId), mode);
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    const tempId = `optimistic-${crypto.randomUUID()}`;
    const maxOrder = lists.reduce((m, l) => Math.max(m, l.sort_order ?? 0), -1);
    const now = new Date().toISOString();
    const optimistic: ShoppingListWithCreator = {
      id: tempId,
      household_id: householdId,
      name: trimmed,
      created_by: null,
      sort_order: maxOrder + 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      shopper_id: null,
      shopper_started_at: null,
      deleted_by: null,
      creator: null,
      shopper: null,
      deleted_by_profile: null,
    };

    const previous = queryClient.getQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId)
    );
    queryClient.setQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId),
      (old) => [...(old ?? []), optimistic]
    );
    setName("");
    setOpen(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({
        household_id: householdId,
        name: trimmed,
        created_by: user?.id ?? null,
        sort_order: maxOrder + 1,
      })
      .select("*, creator:profiles!shopping_lists_created_by_fkey(display_name, email)")
      .single();

    setCreating(false);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(QUERY_KEYS.lists(householdId), previous);
      return;
    }
    queryClient.setQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId),
      (old) =>
        old?.map((l) =>
          l.id === tempId
            ? ({ ...data, creator: data.creator ?? null } as ShoppingListWithCreator)
            : l
        ) ?? []
    );
    toast.success("Lista skapad");
  }

  async function updateList(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !online) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    const previous = queryClient.getQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId)
    );
    queryClient.setQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId),
      (old) =>
        old?.map((l) =>
          l.id === editId
            ? { ...l, name: trimmed, updated_at: new Date().toISOString() }
            : l
        )
    );
    const savedId = editId;
    setEditId(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_lists")
      .update({ name: trimmed })
      .eq("id", savedId);

    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(QUERY_KEYS.lists(householdId), previous);
      setEditId(savedId);
      setEditName(trimmed);
      return;
    }
  }

  async function deleteList(id: string) {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!confirm("Ta bort listan? Den sparas i historiken.")) return;
    const previous = queryClient.getQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId)
    );
    queryClient.setQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId),
      (old) => old?.filter((l) => l.id !== id)
    );
    registerUndo({
      label: "Lista borttagen",
      undo: () =>
        queryClient.setQueryData(QUERY_KEYS.lists(householdId), previous),
    });
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_lists")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(QUERY_KEYS.lists(householdId), previous);
      return;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists(householdId) });
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!online || sortMode !== "manual") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedLists.findIndex((l) => l.id === active.id);
    const newIndex = sortedLists.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(sortedLists, oldIndex, newIndex);
    const previous = queryClient.getQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId)
    );
    queryClient.setQueryData<ShoppingListWithCreator[]>(
      QUERY_KEYS.lists(householdId),
      reordered.map((l, i) => ({ ...l, sort_order: i }))
    );
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((list, index) =>
        supabase
          .from("shopping_lists")
          .update({ sort_order: index })
          .eq("id", list.id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Kunde inte spara ordning");
      queryClient.setQueryData(QUERY_KEYS.lists(householdId), previous);
    }
  }

  const listsPending = isLoading && lists.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold">
          Inköpslistor
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" />
            Ny lista
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Ny inköpslista</DialogTitle>
            </DialogHeader>
            <form onSubmit={createList} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listName">Namn</Label>
                <Input
                  id="listName"
                  placeholder="Veckohandling"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Skapar…" : "Skapa"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ListSortMenu sortMode={sortMode} onSortModeChange={changeSortMode} />

      {listsPending ? (
        <ListsSkeleton />
      ) : lists.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Inga listor ännu. Skapa din första!
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedLists.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1.5">
              {sortedLists.map((list) => (
                <SortableListRow
                  key={list.id}
                  list={list}
                  householdId={householdId}
                  dragEnabled={sortMode === "manual"}
                  onEdit={() => {
                    setEditId(list.id);
                    setEditName(list.name);
                  }}
                  onDelete={() => deleteList(list.id)}
                  onWarm={() => warmList(list.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Redigera lista</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateList} className="space-y-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={savingEdit}>
              {savingEdit ? "Sparar…" : "Spara"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
