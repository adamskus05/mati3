import { createClient } from "@/lib/supabase/server";
import { fetchRecipes } from "@/lib/queries/recipes";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { RecipesView } from "@/components/recipes/recipes-view";
import { redirect } from "next/navigation";
import type { RecipeCategory, RecipeWithCategory } from "@/lib/database.types";

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let initialRecipes: RecipeWithCategory[] | undefined;
  let initialRecipeCategories: RecipeCategory[] | undefined;

  try {
    initialRecipes = await fetchRecipes(supabase, householdId);
  } catch {
    initialRecipes = undefined;
  }

  try {
    initialRecipeCategories = await fetchRecipeCategories(supabase, householdId);
  } catch {
    initialRecipeCategories = undefined;
  }

  return (
    <RecipesView
      householdId={householdId}
      initialRecipes={initialRecipes}
      initialRecipeCategories={initialRecipeCategories}
    />
  );
}
