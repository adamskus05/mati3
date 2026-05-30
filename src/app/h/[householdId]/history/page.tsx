import { createClient } from "@/lib/supabase/server";
import { HistoryView } from "@/components/lists/history-view";
import { fetchArchivedLists } from "@/lib/queries/lists";
import type { ShoppingListWithCreator } from "@/lib/database.types";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();

  let initialLists: ShoppingListWithCreator[] | undefined;
  try {
    initialLists = await fetchArchivedLists(supabase, householdId);
  } catch {
    initialLists = undefined;
  }

  return (
    <HistoryView householdId={householdId} initialLists={initialLists} />
  );
}
