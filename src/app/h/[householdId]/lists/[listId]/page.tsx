import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { ShoppingListDetail } from "@/components/items/shopping-list-detail";
import { fetchList } from "@/lib/queries/lists";
import { fetchListItems } from "@/lib/queries/items";
import { fetchCategories } from "@/lib/queries/categories";
import { notFound, redirect } from "next/navigation";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function ListPage({
  params,
}: {
  params: Promise<{ householdId: string; listId: string }>;
}) {
  const { householdId, listId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = getQueryClient();
  const [list] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: QUERY_KEYS.list(listId),
      queryFn: () => fetchList(supabase, listId),
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.items(listId),
      queryFn: () => fetchListItems(supabase, listId),
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.categories(householdId),
      queryFn: () => fetchCategories(supabase, householdId),
    }),
  ]);

  if (!list) notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ShoppingListDetail
        householdId={householdId}
        listId={listId}
        userId={user.id}
      />
    </HydrationBoundary>
  );
}
