import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/lib/database.types";

export async function fetchCategories(
  supabase: SupabaseClient,
  householdId: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}
