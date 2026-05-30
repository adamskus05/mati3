"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { instructionsFromJson } from "@/lib/queries/recipes";
import type { RecipeWithIngredients } from "@/lib/database.types";
import { QUERY_KEYS } from "@/lib/constants";
import { useOnline } from "@/hooks/use-online";
import { ExportRecipeDialog } from "@/components/recipes/export-recipe-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  groupIngredientsBySection,
  groupInstructionSteps,
} from "@/lib/recipes/instruction-format";
import { toast } from "sonner";

export function RecipeDetail({
  householdId,
  userId,
  recipe,
}: {
  householdId: string;
  userId: string;
  recipe: RecipeWithIngredients;
}) {
  const router = useRouter();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);

  const instructionGroups = groupInstructionSteps(
    instructionsFromJson(recipe.instructions)
  );
  const ingredientGroups = groupIngredientsBySection(recipe.recipe_ingredients);

  async function handleDelete() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!confirm(`Ta bort receptet "${recipe.title}"?`)) return;

    const supabase = createClient();
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.recipes(householdId),
    });
    toast.success("Recept borttaget");
    router.push(`/h/${householdId}/recipes`);
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-start gap-2">
        <Link
          href={`/h/${householdId}/recipes`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold">
            {recipe.title}
          </h1>
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary"
            >
              Källa
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {recipe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.image_url}
          alt=""
          className="aspect-[16/9] w-full rounded-2xl object-cover"
        />
      )}

      <Button
        type="button"
        className="h-[var(--mati-touch)] w-full gap-2 rounded-xl"
        onClick={() => setExportOpen(true)}
      >
        <ShoppingCart className="h-4 w-4" />
        Exportera till inköpslista
      </Button>

      <div className="flex gap-2">
        <Link
          href={`/h/${householdId}/recipes/${recipe.id}/edit`}
          className="inline-flex h-[var(--mati-touch)] flex-1 items-center justify-center gap-1 rounded-xl border border-input bg-background text-sm font-medium hover:bg-muted"
        >
          <Pencil className="h-4 w-4" />
          Redigera
        </Link>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Ingredienser</h2>
          {recipe.recipe_ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga ingredienser</p>
          ) : (
            <div className="space-y-4">
              {ingredientGroups.map((group, gi) => (
                <div key={gi}>
                  {group.section && (
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      {group.section}
                    </h3>
                  )}
                  <ul className="space-y-2">
                    {group.items.map((ing) => {
                      const qty =
                        ing.quantity != null
                          ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}`
                          : ing.unit ?? "";
                      return (
                        <li
                          key={ing.id}
                          className="flex justify-between gap-2 text-[length:var(--mati-text-body)]"
                        >
                          <span>{ing.name}</span>
                          {qty && (
                            <span className="shrink-0 text-muted-foreground">
                              {qty}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {instructionGroups.some((g) => g.section || g.steps.length > 0) && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Gör så här</h2>
            <div className="space-y-4">
              {instructionGroups.map((group, gi) => (
                <div key={gi}>
                  {group.section && (
                    <h3 className="mb-2 text-sm font-semibold text-foreground">
                      {group.section}
                    </h3>
                  )}
                  {group.steps.length > 0 && (
                    <ol className="list-decimal space-y-2 pl-5 text-[length:var(--mati-text-body)]">
                      {group.steps.map((step, si) => (
                        <li key={si}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ExportRecipeDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        householdId={householdId}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        userId={userId}
      />
    </div>
  );
}
