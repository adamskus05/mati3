import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";
import { fetchCategories } from "@/lib/queries/categories";
import { fetchMembers } from "@/lib/queries/households";
import { fetchActiveLists, fetchArchivedLists } from "@/lib/queries/lists";

const STALE_MS = 60_000;

export function prefetchHouseholdTabs(
  queryClient: QueryClient,
  householdId: string
) {
  const supabase = createClient();

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.lists(householdId),
    queryFn: () => fetchActiveLists(supabase, householdId),
    staleTime: STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.categories(householdId),
    queryFn: () => fetchCategories(supabase, householdId),
    staleTime: STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.members(householdId),
    queryFn: () => fetchMembers(supabase, householdId),
    staleTime: STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.listHistory(householdId),
    queryFn: () => fetchArchivedLists(supabase, householdId),
    staleTime: STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.presets(householdId),
    queryFn: async () => {
      const { data } = await supabase
        .from("item_presets")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
    staleTime: STALE_MS,
  });
}
