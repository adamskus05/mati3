import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";

export async function fetchListItems(
  supabase: SupabaseClient,
  listId: string
): Promise<ShoppingItemWithCompleter[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select(
      `
      *,
      completer:profiles!shopping_items_completed_by_fkey ( display_name, email )
    `
    )
    .eq("shopping_list_id", listId);

  if (error) {
    const fallback = await supabase
      .from("shopping_items")
      .select("*")
      .eq("shopping_list_id", listId);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => ({
      ...row,
      completer: null,
    })) as ShoppingItemWithCompleter[];
  }

  return (data ?? []).map((row) => {
    const completer = Array.isArray(row.completer) ? row.completer[0] : row.completer;
    const { completer: _c, ...item } = row as typeof row & { completer?: unknown };
    return {
      ...item,
      completer: completer ?? null,
    } as ShoppingItemWithCompleter;
  });
}
