import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";

const ITEM_SELECT = `
  *,
  completer:profiles!shopping_items_completed_by_fkey ( display_name, email ),
  creator:profiles!shopping_items_created_by_fkey ( display_name, email )
`;

export async function fetchListItems(
  supabase: SupabaseClient,
  listId: string
): Promise<ShoppingItemWithCompleter[]> {
  const { data, error } = await supabase
    .from("shopping_items")
    .select(ITEM_SELECT)
    .eq("shopping_list_id", listId);

  if (error) throw error;

  return (data ?? []) as ShoppingItemWithCompleter[];
}
