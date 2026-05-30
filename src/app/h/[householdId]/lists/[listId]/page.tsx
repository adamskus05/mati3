import { createClient } from "@/lib/supabase/server";
import { ShoppingListDetail } from "@/components/items/shopping-list-detail";
import { fetchList } from "@/lib/queries/lists";
import { fetchListItems } from "@/lib/queries/items";
import { notFound, redirect } from "next/navigation";
import type { Category } from "@/lib/database.types";

export default async function ListPage({
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

  const [list, items, categoriesResult] = await Promise.all([
    fetchList(supabase, listId),
    fetchListItems(supabase, listId),
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order"),
  ]);

  if (!list) notFound();

  const categories = (categoriesResult.data ?? []) as Category[];

  return (
    <ShoppingListDetail
      householdId={householdId}
      listId={listId}
      userId={user.id}
      initialList={list}
      initialItems={items}
      initialCategories={categories}
    />
  );
}
