import { createClient } from "@/lib/supabase/server";
import { MembersView } from "@/components/household/members-view";
import { fetchMembers } from "@/lib/queries/households";
import { redirect } from "next/navigation";
import type { MemberWithProfile } from "@/lib/database.types";

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

  let initialMembers: MemberWithProfile[] | undefined;
  try {
    initialMembers = await fetchMembers(supabase, householdId);
  } catch {
    initialMembers = undefined;
  }

  return (
    <MembersView
      householdId={householdId}
      userId={user.id}
      initialMembers={initialMembers}
    />
  );
}
