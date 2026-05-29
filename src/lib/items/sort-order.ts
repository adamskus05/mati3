import type { SupabaseClient } from "@supabase/supabase-js";

export async function getNextSortOrder(
  supabase: SupabaseClient,
  listId: string,
  categoryId: string | null
): Promise<number> {
  let query = supabase
    .from("shopping_items")
    .select("sort_order")
    .eq("shopping_list_id", listId)
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
