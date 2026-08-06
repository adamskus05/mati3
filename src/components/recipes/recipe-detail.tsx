"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Pencil,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { instructionsFromJson } from "@/lib/queries/recipes";
import type {
  RecipeWithCategory,
  RecipeWithIngredients,
} from "@/lib/database.types";
import { QUERY_KEYS } from "@/lib/constants";
import { useOnline } from "@/hooks/use-online";
import { ExportRecipeDialog } from "@/components/recipes/export-recipe-dialog";
import { RecipesBackLink } from "@/components/recipes/recipes-back-link";
import {
  RecipeScalePanel,
  useRecipeIngredientScale,
} from "@/components/recipes/recipe-scale-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  groupIngredientsBySection,
  groupInstructionSteps,
  MATI_INGREDIENT_LIST_CLASS,
} from "@/lib/recipes/instruction-format";
import {
  formatRecipeQuantity,
  ingredientsWithQuantity,
  toExportIngredients,
} from "@/lib/recipes/scale-ingredients";
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
  const [deleting, setDeleting] = useState(false);

  const scalable = useMemo(
    () => ingredientsWithQuantity(recipe.recipe_ingredients),
    [recipe.recipe_ingredients]
  );

  function getScaleUiState() {
    const savedAnchor = recipe.scale_anchor_ingredient_id ?? null;
    const savedQty = recipe.scale_new_quantity;
    const validAnchor =
      savedAnchor && scalable.some((i) => i.id === savedAnchor)
        ? savedAnchor
        : (scalable[0]?.id ?? null);
    let qtyInput = "";
    if (
      savedQty != null &&
      savedAnchor &&
      scalable.some((i) => i.id === savedAnchor)
    ) {
      const n = Number(savedQty);
      if (Number.isFinite(n)) qtyInput = String(n);
    }
    return { anchorId: validAnchor, newQuantityInput: qtyInput };
  }

  const [anchorId, setAnchorId] = useState<string | null>(
    () => getScaleUiState().anchorId
  );
  const [newQuantityInput, setNewQuantityInput] = useState(
    () => getScaleUiState().newQuantityInput
  );
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    const next = getScaleUiState();
    setAnchorId(next.anchorId);
    setNewQuantityInput(next.newQuantityInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when recipe or saved scale changes
  }, [
    recipe.id,
    recipe.scale_anchor_ingredient_id,
    recipe.scale_new_quantity,
    recipe.recipe_ingredients,
  ]);

  const hasSavedPreset =
    recipe.scale_anchor_ingredient_id != null &&
    recipe.scale_new_quantity != null &&
    scalable.some((i) => i.id === recipe.scale_anchor_ingredient_id);

  const scaleResult = useRecipeIngredientScale(
    recipe.recipe_ingredients,
    anchorId,
    newQuantityInput
  );

  const displayIngredients = useMemo(() => {
    const byId = new Map(scaleResult.rows.map((r) => [r.id, r]));
    return recipe.recipe_ingredients.map(
      (ing) => byId.get(ing.id) ?? { ...ing, scaledQuantity: ing.quantity, isScaled: false }
    );
  }, [recipe.recipe_ingredients, scaleResult.rows]);

  const ingredientGroups = groupIngredientsBySection(displayIngredients);

  const exportOverrides = useMemo(() => {
    if (scaleResult.factor == null) return undefined;
    return toExportIngredients(scaleResult.rows);
  }, [scaleResult]);

  const instructionGroups = groupInstructionSteps(
    instructionsFromJson(recipe.instructions)
  );

  function handleResetScale() {
    setNewQuantityInput("");
    setAnchorId(scalable[0]?.id ?? null);
  }

  async function handleSaveScalePreset() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    const parsed = parseFloat(newQuantityInput.replace(",", "."));
    if (!anchorId || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Välj bas-ingrediens och ange en giltig ny mängd");
      return;
    }
    setSavingPreset(true);
    const { error } = await createClient()
      .from("recipes")
      .update({
        scale_anchor_ingredient_id: anchorId,
        scale_new_quantity: parsed,
      })
      .eq("id", recipe.id);
    setSavingPreset(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.recipes(householdId),
    });
    toast.success("Portionsskala sparad för hushållet");
    router.refresh();
  }

  async function handleClearScalePreset() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    setSavingPreset(true);
    const { error } = await createClient()
      .from("recipes")
      .update({
        scale_anchor_ingredient_id: null,
        scale_new_quantity: null,
      })
      .eq("id", recipe.id);
    setSavingPreset(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    handleResetScale();
    await queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.recipes(householdId),
    });
    toast.success("Sparad standard borttagen");
    router.refresh();
  }

  async function handleDelete() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!confirm(`Ta bort receptet "${recipe.title}"?`)) return;

    setDeleting(true);
    const key = QUERY_KEYS.recipes(householdId);
    const previous = queryClient.getQueryData<RecipeWithCategory[]>(key);
    queryClient.setQueryData<RecipeWithCategory[]>(key, (old) =>
      old?.filter((r) => r.id !== recipe.id)
    );
    router.push(`/h/${householdId}/recipes`);

    const { error } = await createClient()
      .from("recipes")
      .delete()
      .eq("id", recipe.id);

    setDeleting(false);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(key, previous);
      router.push(`/h/${householdId}/recipes/${recipe.id}`);
      return;
    }

    toast.success("Recept borttaget");
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-start gap-2">
        <RecipesBackLink householdId={householdId} />
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold">
            {recipe.title}
          </h1>
          {recipe.recipe_category && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${recipe.recipe_category.color}33`,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: recipe.recipe_category.color }}
                aria-hidden
              />
              {recipe.recipe_category.name}
            </span>
          )}
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
        {scaleResult.factor != null && (
          <span className="text-xs opacity-80">(anpassade mängder)</span>
        )}
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
          disabled={deleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Ingredienser</h2>
          <RecipeScalePanel
            ingredients={recipe.recipe_ingredients}
            anchorId={anchorId}
            newQuantityInput={newQuantityInput}
            onAnchorIdChange={setAnchorId}
            onNewQuantityChange={setNewQuantityInput}
            onReset={handleResetScale}
            hasSavedPreset={hasSavedPreset}
            onSavePreset={handleSaveScalePreset}
            onClearSavedPreset={handleClearScalePreset}
            savingPreset={savingPreset}
          />
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
                  <ul className={MATI_INGREDIENT_LIST_CLASS}>
                    {group.items.map((ing) => {
                      const showScaled =
                        ing.isScaled &&
                        ing.scaledQuantity != null &&
                        ing.quantity != null &&
                        ing.scaledQuantity !== ing.quantity;
                      const displayQty =
                        ing.scaledQuantity != null
                          ? formatRecipeQuantity(ing.scaledQuantity, ing.unit)
                          : ing.unit ?? "";
                      const originalQty =
                        ing.quantity != null
                          ? formatRecipeQuantity(ing.quantity, ing.unit)
                          : null;

                      return (
                        <li
                          key={ing.id}
                          className="text-[length:var(--mati-text-body)]"
                        >
                          <span className="flex justify-between gap-2">
                            <span>{ing.name}</span>
                            {displayQty && (
                              <span className="shrink-0 text-right text-muted-foreground">
                                {displayQty}
                              </span>
                            )}
                          </span>
                          {showScaled && originalQty && (
                            <p className="text-right text-xs text-muted-foreground">
                              urspr. {originalQty}
                            </p>
                          )}
                          {ing.notes?.trim() && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {ing.notes}
                            </p>
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
        ingredientOverrides={exportOverrides}
      />
    </div>
  );
}
