import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";
import { fetchList } from "@/lib/queries/lists";
import { fetchListItems } from "@/lib/queries/items";

export function prefetchListDetail(
  queryClient: QueryClient,
  householdId: string,
  listId: string
) {
  const supabase = createClient();

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.list(listId),
    queryFn: () => fetchList(supabase, listId),
    staleTime: 60_000,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.items(listId),
    queryFn: () => fetchListItems(supabase, listId),
    staleTime: 30_000,
  });

  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.categories(householdId),
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
    staleTime: 60_000,
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
    staleTime: 60_000,
  });
}
