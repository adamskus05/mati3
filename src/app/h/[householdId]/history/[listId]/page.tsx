import { createClient } from "@/lib/supabase/server";
import { ShoppingListDetail } from "@/components/items/shopping-list-detail";
import { redirect } from "next/navigation";

export default async function HistoryListPage({
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

  return (
    <ShoppingListDetail
      householdId={householdId}
      listId={listId}
      userId={user.id}
      readOnly
    />
  );
}
