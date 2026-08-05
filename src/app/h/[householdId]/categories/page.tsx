import { redirect } from "next/navigation";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}?tab=categories`);
}
