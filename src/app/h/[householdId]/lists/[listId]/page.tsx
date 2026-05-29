import { ShoppingListDetail } from "@/components/items/shopping-list-detail";

export default async function ListPage({
  params,
}: {
  params: Promise<{ householdId: string; listId: string }>;
}) {
  const { householdId, listId } = await params;
  return (
    <ShoppingListDetail householdId={householdId} listId={listId} />
  );
}
