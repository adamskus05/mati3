import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";

/** Fast list load: no profile join; completer filled when item is completed client-side if needed. */
export async function fetchListItems(
  supabase: SupabaseClient,
  listId: string
): Promise<ShoppingItemWithCompleter[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("shopping_list_id", listId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    completer: null,
  })) as ShoppingItemWithCompleter[];
}
