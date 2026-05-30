import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchRecipe } from "@/lib/queries/recipes";
import { QUERY_KEYS } from "@/lib/constants";

const STALE_MS = 60_000;

export function prefetchRecipeDetail(
  queryClient: QueryClient,
  recipeId: string
) {
  void queryClient.prefetchQuery({
    queryKey: QUERY_KEYS.recipe(recipeId),
    queryFn: () => fetchRecipe(createClient(), recipeId),
    staleTime: STALE_MS,
  });
}
