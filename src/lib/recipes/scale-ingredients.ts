import type { RecipeIngredient } from "@/lib/database.types";

export type ScaledIngredientRow<T extends { id: string; quantity: number | null }> = T & {
  scaledQuantity: number | null;
  isScaled: boolean;
};

export type IngredientScaleResult<T extends { id: string; quantity: number | null }> = {
  factor: number | null;
  rows: ScaledIngredientRow<T>[];
};

export type ExportIngredientRow = {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
};

export function computeScaleFactor(
  originalQty: number,
  newQty: number
): number | null {
  if (!Number.isFinite(originalQty) || !Number.isFinite(newQty)) return null;
  if (originalQty <= 0 || newQty <= 0) return null;
  return newQty / originalQty;
}

/** Round for display/storage; keeps reasonable precision for cooking. */
export function scaleIngredientQuantity(qty: number, factor: number): number {
  const value = qty * factor;
  if (!Number.isFinite(value)) return qty;
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatRecipeQuantity(
  qty: number,
  unit: string | null | undefined
): string {
  const n = formatQuantityNumber(qty);
  if (unit?.trim()) return `${n} ${unit.trim()}`;
  return n;
}

export function formatQuantityNumber(qty: number): string {
  if (!Number.isFinite(qty)) return String(qty);
  const rounded = Math.round(qty * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/\.?0+$/, "").replace(".", ",");
}

export function formatScaleFactorBadge(factor: number): string {
  const s = formatQuantityNumber(factor);
  return `×${s}`;
}

export function applyIngredientScale<T extends RecipeIngredient>(
  ingredients: T[],
  anchorId: string | null,
  newQuantity: number | null
): IngredientScaleResult<T> {
  const unchanged = ingredients.map((ing) => ({
    ...ing,
    scaledQuantity: ing.quantity,
    isScaled: false,
  }));

  if (!anchorId || newQuantity == null || !Number.isFinite(newQuantity)) {
    return { factor: null, rows: unchanged };
  }

  const anchor = ingredients.find((i) => i.id === anchorId);
  if (!anchor || anchor.quantity == null) {
    return { factor: null, rows: unchanged };
  }

  const factor = computeScaleFactor(anchor.quantity, newQuantity);
  if (factor == null) {
    return { factor: null, rows: unchanged };
  }

  const rows = ingredients.map((ing) => {
    if (ing.id === anchorId) {
      return {
        ...ing,
        scaledQuantity: newQuantity,
        isScaled: true,
      };
    }
    if (ing.quantity == null) {
      return { ...ing, scaledQuantity: null, isScaled: false };
    }
    return {
      ...ing,
      scaledQuantity: scaleIngredientQuantity(ing.quantity, factor),
      isScaled: true,
    };
  });

  return { factor, rows };
}

export function toExportIngredients<T extends RecipeIngredient>(
  rows: ScaledIngredientRow<T>[]
): ExportIngredientRow[] {
  return rows
    .filter((ing) => ing.name.trim())
    .map((ing) => ({
      name: ing.name.trim(),
      quantity: ing.scaledQuantity,
      unit: ing.unit,
      notes: ing.notes,
    }));
}

export function ingredientsWithQuantity<T extends { id: string; name: string; quantity: number | null; unit: string | null }>(
  ingredients: T[]
): T[] {
  return ingredients.filter((i) => i.quantity != null);
}

export function anchorSelectLabel<T extends { name: string; quantity: number | null; unit: string | null }>(
  ing: T
): string {
  return `${ing.name} — ${formatRecipeQuantity(ing.quantity!, ing.unit)}`;
}
