import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { fetchActiveLists } from "@/lib/queries/lists";
import { ListsView } from "@/components/lists/lists-view";
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
  try {
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.lists(householdId),
      queryFn: () => fetchActiveLists(supabase, householdId),
    });
  } catch {
    // Client refetches on failure
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListsView householdId={householdId} />
    </HydrationBoundary>
  );
}
