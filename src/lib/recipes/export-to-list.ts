import type { SupabaseClient } from "@supabase/supabase-js";
import { getNextSortOrderFromItems } from "@/lib/items/sort-order";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";

export async function exportRecipeToList(
  supabase: SupabaseClient,
  recipeId: string,
  listId: string
): Promise<number> {
  const { data: ingredients, error: ingError } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order");

  if (ingError) throw ingError;
  if (!ingredients?.length) return 0;

  const { data: existing, error: listError } = await supabase
    .from("shopping_items")
    .select("id, category_id, completed, sort_order")
    .eq("shopping_list_id", listId);

  if (listError) throw listError;

  const baseItems = (existing ?? []) as Pick<
    ShoppingItemWithCompleter,
    "category_id" | "completed" | "sort_order"
  >[];

  let sortBase = baseItems;
  const rows = ingredients.filter((ing) => ing.name.trim()).map((ing) => {
    const sort_order = getNextSortOrderFromItems(sortBase, null, false);
    const row = {
      shopping_list_id: listId,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes,
      category_id: null,
      completed: false,
      sort_order,
    };
    sortBase = [
      ...sortBase,
      {
        category_id: null,
        completed: false,
        sort_order,
      },
    ];
    return row;
  });

  const { error: insertError } = await supabase
    .from("shopping_items")
    .insert(rows);

  if (insertError) throw insertError;
  return rows.length;
}
