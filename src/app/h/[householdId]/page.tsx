import { ListsView } from "@/components/lists/lists-view";

export default async function HouseholdPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <ListsView householdId={householdId} />;
}
