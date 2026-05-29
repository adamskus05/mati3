import { createClient } from "@/lib/supabase/server";
import { MembersView } from "@/components/household/members-view";
import { redirect } from "next/navigation";

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

  return <MembersView householdId={householdId} userId={user.id} />;
}
