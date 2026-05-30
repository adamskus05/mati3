import { createClient } from "@/lib/supabase/server";
import { fetchRecipe } from "@/lib/queries/recipes";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { notFound, redirect } from "next/navigation";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ householdId: string; recipeId: string }>;
}) {
  const { householdId, recipeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const recipe = await fetchRecipe(supabase, recipeId);
  if (!recipe || recipe.household_id !== householdId) notFound();

  return (
    <RecipeEditor householdId={householdId} userId={user.id} recipe={recipe} />
  );
}
