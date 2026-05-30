import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { MembersView } from "@/components/household/members-view";
import { fetchMembers, fetchMyMembership } from "@/lib/queries/households";
import { redirect } from "next/navigation";
import { QUERY_KEYS } from "@/lib/constants";
import { getQueryClient } from "@/lib/query/get-query-client";

export default async function MembersPage({
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
      queryKey: QUERY_KEYS.members(householdId),
      queryFn: () => fetchMembers(supabase, householdId),
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.myMembership(householdId, user.id),
      queryFn: () => fetchMyMembership(supabase, householdId, user.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MembersView householdId={householdId} userId={user.id} />
    </HydrationBoundary>
  );
}
