"use client";

import { useMemo } from "react";
import type { RecipeIngredient } from "@/lib/database.types";
import {
  anchorSelectLabel,
  applyIngredientScale,
  formatScaleFactorBadge,
  ingredientsWithQuantity,
} from "@/lib/recipes/scale-ingredients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecipeScalePanel({
  ingredients,
  anchorId,
  newQuantityInput,
  onAnchorIdChange,
  onNewQuantityChange,
  onReset,
}: {
  ingredients: RecipeIngredient[];
  anchorId: string | null;
  newQuantityInput: string;
  onAnchorIdChange: (id: string) => void;
  onNewQuantityChange: (value: string) => void;
  onReset: () => void;
}) {
  const scalable = useMemo(
    () => ingredientsWithQuantity(ingredients),
    [ingredients]
  );

  const anchor = scalable.find((i) => i.id === anchorId) ?? scalable[0];
  const parsedNewQty = parseFloat(newQuantityInput.replace(",", "."));
  const scalePreview = applyIngredientScale(
    ingredients,
    anchor?.id ?? null,
    Number.isFinite(parsedNewQty) ? parsedNewQty : null
  );

  if (scalable.length === 0) return null;

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Anpassa mängder</p>
        {scalePreview.factor != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {formatScaleFactorBadge(scalePreview.factor)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Välj en ingrediens som bas — övriga mängder räknas om tillfälligt (sparas inte i
        receptet).
      </p>
      <div className="space-y-2">
        <Label htmlFor="scaleAnchor">Bas-ingrediens</Label>
        <select
          id="scaleAnchor"
          value={anchorId ?? anchor?.id ?? ""}
          onChange={(e) => onAnchorIdChange(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          {scalable.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {anchorSelectLabel(ing)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="scaleNewQty">Ny mängd</Label>
          <Input
            id="scaleNewQty"
            type="text"
            inputMode="decimal"
            value={newQuantityInput}
            onChange={(e) => onNewQuantityChange(e.target.value)}
            placeholder={anchor?.quantity != null ? String(anchor.quantity) : ""}
            className="h-9 rounded-lg"
          />
        </div>
        {anchor?.unit && (
          <span className="pb-2 text-sm text-muted-foreground">{anchor.unit}</span>
        )}
      </div>
      {scalePreview.factor != null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full"
          onClick={onReset}
        >
          Återställ originalmängder
        </Button>
      )}
    </div>
  );
}

export function useRecipeIngredientScale(
  ingredients: RecipeIngredient[],
  anchorId: string | null,
  newQuantityInput: string
) {
  const parsedNewQty = parseFloat(newQuantityInput.replace(",", "."));
  return useMemo(
    () =>
      applyIngredientScale(
        ingredients,
        anchorId,
        Number.isFinite(parsedNewQty) ? parsedNewQty : null
      ),
    [ingredients, anchorId, parsedNewQty]
  );
}
