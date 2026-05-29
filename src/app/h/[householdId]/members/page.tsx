import { MembersView } from "@/components/household/members-view";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <MembersView householdId={householdId} />;
}
