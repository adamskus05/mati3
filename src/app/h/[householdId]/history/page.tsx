import { redirect } from "next/navigation";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}/settings?tab=history`);
}
