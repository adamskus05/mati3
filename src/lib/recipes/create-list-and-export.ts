import type { SupabaseClient } from "@supabase/supabase-js";
import { exportRecipeToList } from "@/lib/recipes/export-to-list";
import type { ExportIngredientRow } from "@/lib/recipes/scale-ingredients";

export async function createListAndExportRecipe(
  supabase: SupabaseClient,
  householdId: string,
  userId: string | null,
  recipeId: string,
  listName: string,
  ingredientOverrides?: ExportIngredientRow[]
): Promise<{ listId: string; itemCount: number }> {
  const { data: lists, error: orderError } = await supabase
    .from("shopping_lists")
    .select("sort_order")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (orderError) throw orderError;

  const maxOrder = lists?.[0]?.sort_order ?? -1;

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: householdId,
      name: listName.trim(),
      created_by: userId,
      sort_order: maxOrder + 1,
    })
    .select("id")
    .single();

  if (listError) throw listError;

  const result = await exportRecipeToList(
    supabase,
    recipeId,
    list.id,
    ingredientOverrides,
    { mergeWithExisting: false }
  );
  return { listId: list.id, itemCount: result.total };
}
