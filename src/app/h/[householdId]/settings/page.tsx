import { createClient } from "@/lib/supabase/server";
import { fetchHousehold } from "@/lib/queries/households";
import { SettingsView } from "@/components/settings/settings-view";
import { notFound } from "next/navigation";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const household = await fetchHousehold(supabase, householdId);
  if (!household) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .single<{ display_name: string | null }>();

  return (
    <SettingsView
      householdId={householdId}
      userId={user!.id}
      inviteCode={household.invite_code}
      householdName={household.name}
      profileName={profile?.display_name ?? ""}
    />
  );
}
