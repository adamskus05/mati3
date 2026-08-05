import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchActiveLists } from "@/lib/queries/lists";
import { fetchCategories } from "@/lib/queries/categories";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { ListsHub } from "@/components/lists/lists-hub";
import { redirect } from "next/navigation";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function HouseholdPage({
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
      queryKey: QUERY_KEYS.lists(householdId),
      queryFn: () => fetchActiveLists(supabase, householdId),
    }),
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
      <Suspense fallback={null}>
        <ListsHub householdId={householdId} />
      </Suspense>
    </HydrationBoundary>
  );
}
