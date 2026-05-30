import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { CategoriesHub } from "@/components/categories/categories-hub";
import { fetchCategories } from "@/lib/queries/categories";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const queryClient = getQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.categories(householdId),
      queryFn: () => fetchCategories(supabase, householdId),
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.recipeCategories(householdId),
      queryFn: () => fetchRecipeCategories(supabase, householdId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CategoriesHub householdId={householdId} />
    </HydrationBoundary>
  );
}
