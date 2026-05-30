import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShoppingList, ShoppingListWithCreator } from "@/lib/database.types";

function mapListRow(row: Record<string, unknown>): ShoppingListWithCreator {
  const creator = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const shopper = Array.isArray(row.shopper) ? row.shopper[0] : row.shopper;
  const deletedByProfile = Array.isArray(row.deleted_by_profile)
    ? row.deleted_by_profile[0]
    : row.deleted_by_profile;
  const { profiles, shopper: _s, deleted_by_profile: _d, ...list } = row;
  return {
    ...(list as ShoppingList),
    creator: creator as ShoppingListWithCreator["creator"],
    shopper: shopper as ShoppingListWithCreator["shopper"],
    deleted_by_profile:
      deletedByProfile as ShoppingListWithCreator["deleted_by_profile"],
  };
}

const listSelect = `
  *,
  profiles!shopping_lists_created_by_fkey ( display_name, email ),
  shopper:profiles!shopping_lists_shopper_id_fkey ( display_name, email ),
  deleted_by_profile:profiles!shopping_lists_deleted_by_fkey ( display_name, email )
`;

export async function fetchActiveLists(
  supabase: SupabaseClient,
  householdId: string
): Promise<ShoppingListWithCreator[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(listSelect)
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("shopping_lists")
      .select(`*, profiles!created_by ( display_name, email )`)
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => ({
      ...row,
      creator: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      shopper: null,
      deleted_by_profile: null,
    })) as ShoppingListWithCreator[];
  }

  return (data ?? []).map((row) => mapListRow(row as Record<string, unknown>));
}

export async function fetchArchivedLists(
  supabase: SupabaseClient,
  householdId: string
): Promise<ShoppingListWithCreator[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(listSelect)
    .eq("household_id", householdId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("shopping_lists")
      .select(`*, profiles!created_by ( display_name, email )`)
      .eq("household_id", householdId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row) => ({
      ...row,
      creator: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      shopper: null,
      deleted_by_profile: null,
    })) as ShoppingListWithCreator[];
  }

  return (data ?? []).map((row) => mapListRow(row as Record<string, unknown>));
}

export async function fetchList(
  supabase: SupabaseClient,
  listId: string
): Promise<ShoppingListWithCreator | null> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(listSelect)
    .eq("id", listId)
    .maybeSingle();

  if (error || !data) {
    const fb = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("id", listId)
      .maybeSingle();
    if (fb.error || !fb.data) return null;
    return { ...fb.data, creator: null, shopper: null, deleted_by_profile: null };
  }

  return mapListRow(data as Record<string, unknown>);
}
