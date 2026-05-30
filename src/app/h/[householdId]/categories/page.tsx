import { createClient } from "@/lib/supabase/server";
import { CategoriesView } from "@/components/categories/categories-view";
import { fetchCategories } from "@/lib/queries/categories";
import type { Category } from "@/lib/database.types";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();

  let initialCategories: Category[] | undefined;
  try {
    initialCategories = await fetchCategories(supabase, householdId);
  } catch {
    initialCategories = undefined;
  }

  return (
    <CategoriesView
      householdId={householdId}
      initialCategories={initialCategories}
    />
  );
}
