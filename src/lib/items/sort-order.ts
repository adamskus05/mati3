import type { SupabaseClient } from "@supabase/supabase-js";

/** Next sort_order within list + category, optionally filtered by completed group. */
export async function getNextSortOrder(
  supabase: SupabaseClient,
  listId: string,
  categoryId: string | null,
  completed: boolean
): Promise<number> {
  let query = supabase
    .from("shopping_items")
    .select("sort_order")
    .eq("shopping_list_id", listId)
    .eq("completed", completed)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  } else {
    query = query.is("category_id", null);
  }

  const { data } = await query;
  const max = data?.[0]?.sort_order ?? -1;
  return max + 1;
}

/** Instant sort_order from in-memory list (no network round-trip). */
export function getNextSortOrderFromItems<
  T extends { category_id: string | null; completed: boolean; sort_order: number },
>(items: T[], categoryId: string | null, completed: boolean): number {
  let max = -1;
  for (const item of items) {
    if (item.completed !== completed) continue;
    const sameCategory =
      categoryId === null
        ? item.category_id === null
        : item.category_id === categoryId;
    if (sameCategory && item.sort_order > max) max = item.sort_order;
  }
  return max + 1;
}

export function sortItemsInCategory<
  T extends { completed: boolean; sort_order: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.sort_order - b.sort_order;
  });
}

export function sortItemsForDisplay<
  T extends { completed: boolean; sort_order: number; category_id: string | null },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.category_id !== b.category_id) return 0;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.sort_order - b.sort_order;
  });
}

export function groupItemsByCategory<
  T extends { category_id: string | null; completed: boolean; sort_order: number },
>(items: T[]): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.category_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sort_order - b.sort_order;
    });
    groups.set(key, sorted);
  }

  return groups;
}
