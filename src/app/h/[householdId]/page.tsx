import { createClient } from "@/lib/supabase/server";
import { fetchActiveLists } from "@/lib/queries/lists";
import { ListsView } from "@/components/lists/lists-view";
import { redirect } from "next/navigation";
import type { ShoppingListWithCreator } from "@/lib/database.types";

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

  let initialLists: ShoppingListWithCreator[] | undefined;
  try {
    initialLists = await fetchActiveLists(supabase, householdId);
  } catch {
    initialLists = undefined;
  }

  return (
    <ListsView householdId={householdId} initialLists={initialLists} />
  );
}
