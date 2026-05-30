import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { HistoryView } from "@/components/lists/history-view";
import { fetchArchivedLists } from "@/lib/queries/lists";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.listHistory(householdId),
      queryFn: () => fetchArchivedLists(supabase, householdId),
    });
  } catch {
    // Client refetches on failure
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HistoryView householdId={householdId} />
    </HydrationBoundary>
  );
}
