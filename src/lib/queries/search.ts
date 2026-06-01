import type { SupabaseClient } from "@supabase/supabase-js";

export type HouseholdSearchResult = {
  kind: "recipe" | "list" | "item" | "category" | "recipe_category";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export async function searchHousehold(
  supabase: SupabaseClient,
  householdId: string,
  query: string,
  limit = 24
): Promise<HouseholdSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_household", {
    p_household_id: householdId,
    p_query: q,
    p_limit: limit,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return (rows as HouseholdSearchResult[]).filter(
    (row) =>
      row &&
      typeof row.kind === "string" &&
      typeof row.id === "string" &&
      typeof row.title === "string" &&
      typeof row.href === "string"
  );
}
