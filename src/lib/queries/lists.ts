import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingList, ShoppingListWithCreator } from "@/lib/database.types";

export async function fetchActiveLists(
  supabase: SupabaseClient,
  householdId: string
): Promise<ShoppingListWithCreator[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(
      `
      *,
      profiles!created_by ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    creator: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
  })) as ShoppingListWithCreator[];
}

export async function fetchArchivedLists(
  supabase: SupabaseClient,
  householdId: string
): Promise<ShoppingListWithCreator[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(
      `
      *,
      profiles!created_by ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    creator: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
  })) as ShoppingListWithCreator[];
}

export async function fetchList(
  supabase: SupabaseClient,
  listId: string
): Promise<ShoppingList | null> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .single();

  if (error) return null;
  return data;
}
