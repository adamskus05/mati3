import { createClient } from "@/lib/supabase/server";
import { CategoriesHub } from "@/components/categories/categories-hub";
import { fetchCategories } from "@/lib/queries/categories";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import type { Category, RecipeCategory } from "@/lib/database.types";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();

  let initialItemCategories: Category[] | undefined;
  let initialRecipeCategories: RecipeCategory[] | undefined;

  try {
    initialItemCategories = await fetchCategories(supabase, householdId);
  } catch {
    initialItemCategories = undefined;
  }

  try {
    initialRecipeCategories = await fetchRecipeCategories(supabase, householdId);
  } catch {
    initialRecipeCategories = undefined;
  }

  return (
    <CategoriesHub
      householdId={householdId}
      initialItemCategories={initialItemCategories}
      initialRecipeCategories={initialRecipeCategories}
    />
  );
}
