import type { QueryClient } from "@tanstack/react-query";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";
import { debouncedInvalidate } from "@/lib/query/debounced-invalidate";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

function rowToItem(row: Record<string, unknown>): ShoppingItemWithCompleter {
  return {
    id: String(row.id),
    shopping_list_id: String(row.shopping_list_id),
    category_id: (row.category_id as string | null) ?? null,
    name: String(row.name),
    quantity: (row.quantity as number | null) ?? null,
    unit: (row.unit as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    completed: Boolean(row.completed),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    completed_by: (row.completed_by as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    completer: undefined,
    creator: undefined,
  };
}

export function applyShoppingItemRealtime(
  queryClient: QueryClient,
  listId: string,
  queryKey: readonly unknown[],
  payload: RealtimePayload
) {
  const current = queryClient.getQueryData<ShoppingItemWithCompleter[]>(queryKey);
  if (!current) {
    debouncedInvalidate(queryClient, queryKey);
    return;
  }

  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === "INSERT" && newRow) {
    const id = String(newRow.id);
    if (current.some((i) => i.id === id)) return;
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(queryKey, [
      ...current,
      rowToItem(newRow),
    ]);
    // Resolve creator/completer names via refetch (joins not in realtime payload)
    debouncedInvalidate(queryClient, queryKey);
    return;
  }

  if (eventType === "UPDATE" && newRow) {
    const id = String(newRow.id);
    if (!current.some((i) => i.id === id)) {
      debouncedInvalidate(queryClient, queryKey);
      return;
    }
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(queryKey, (old) =>
      old?.map((i) =>
        i.id === id
          ? {
              ...i,
              ...rowToItem(newRow),
              completer: i.completer,
              creator: i.creator,
            }
          : i
      )
    );
    if (newRow.completed_by && !current.find((i) => i.id === id)?.completer) {
      debouncedInvalidate(queryClient, queryKey);
    }
    return;
  }

  if (eventType === "DELETE" && oldRow) {
    const id = String(oldRow.id);
    queryClient.setQueryData<ShoppingItemWithCompleter[]>(queryKey, (old) =>
      old?.filter((i) => i.id !== id)
    );
    return;
  }

  debouncedInvalidate(queryClient, queryKey);
}
