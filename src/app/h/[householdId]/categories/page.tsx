import { CategoriesView } from "@/components/categories/categories-view";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return <CategoriesView householdId={householdId} />;
}
