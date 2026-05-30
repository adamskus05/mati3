import { createClient } from "@/lib/supabase/server";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { redirect } from "next/navigation";

export default async function NewRecipePage({
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

  return <RecipeEditor householdId={householdId} userId={user.id} />;
}
