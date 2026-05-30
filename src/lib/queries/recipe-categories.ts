import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeCategory } from "@/lib/database.types";

export async function fetchRecipeCategories(
  supabase: SupabaseClient,
  householdId: string
): Promise<RecipeCategory[]> {
  const { data, error } = await supabase
    .from("recipe_categories")
    .select("*")
    .eq("household_id", householdId)
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}
