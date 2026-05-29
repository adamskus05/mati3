import { HistoryView } from "@/components/lists/history-view";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <HistoryView householdId={householdId} />;
}
