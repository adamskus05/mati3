import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { fetchRecipes } from "@/lib/queries/recipes";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { RecipesView } from "@/components/recipes/recipes-view";
import { redirect } from "next/navigation";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = getQueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.recipes(householdId),
      queryFn: () => fetchRecipes(supabase, householdId),
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.recipeCategories(householdId),
      queryFn: () => fetchRecipeCategories(supabase, householdId),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecipesView householdId={householdId} />
    </HydrationBoundary>
  );
}
