import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchHousehold } from "@/lib/queries/households";
import { AppShell } from "@/components/layout/app-shell";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const household = await fetchHousehold(supabase, householdId);
  if (!household) notFound();

  return (
    <AppShell householdId={householdId} householdName={household.name}>
      {children}
    </AppShell>
  );
}
