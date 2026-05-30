import { createClient } from "@/lib/supabase/server";
import { fetchRecipes } from "@/lib/queries/recipes";
import { RecipesView } from "@/components/recipes/recipes-view";
import { redirect } from "next/navigation";
import type { Recipe } from "@/lib/database.types";

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

  let initialRecipes: Recipe[] | undefined;
  try {
    initialRecipes = await fetchRecipes(supabase, householdId);
  } catch {
    initialRecipes = undefined;
  }

  return (
    <RecipesView householdId={householdId} initialRecipes={initialRecipes} />
  );
}
