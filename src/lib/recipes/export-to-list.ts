import type { SupabaseClient } from "@supabase/supabase-js";
import { getNextSortOrderFromItems } from "@/lib/items/sort-order";
import {
  planExportMerge,
  type ExistingListItem,
  type ExportToListResult,
} from "@/lib/items/merge-export-ingredients";
import type { ExportIngredientRow } from "@/lib/recipes/scale-ingredients";

export type { ExportToListResult };

export async function exportRecipeToList(
  supabase: SupabaseClient,
  recipeId: string,
  listId: string,
  ingredientOverrides?: ExportIngredientRow[],
  options?: { mergeWithExisting?: boolean }
): Promise<ExportToListResult> {
  const mergeWithExisting = options?.mergeWithExisting ?? true;

  let ingredients: ExportIngredientRow[];

  if (ingredientOverrides) {
    ingredients = ingredientOverrides;
  } else {
    const { data, error: ingError } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("sort_order");

    if (ingError) throw ingError;
    if (!data?.length) return { merged: 0, added: 0, total: 0 };

    ingredients = data.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes,
    }));
  }

  const filtered = ingredients.filter((ing) => ing.name.trim());
  if (!filtered.length) return { merged: 0, added: 0, total: 0 };

  const { data: existing, error: listError } = await supabase
    .from("shopping_items")
    .select(
      "id, name, quantity, unit, notes, category_id, completed, sort_order"
    )
    .eq("shopping_list_id", listId);

  if (listError) throw listError;

  const existingItems = (existing ?? []) as ExistingListItem[];

  if (!mergeWithExisting || existingItems.length === 0) {
    let sortBase = existingItems;
    const rows = filtered.map((ing) => {
      const sort_order = getNextSortOrderFromItems(sortBase, null, false);
      const row = {
        shopping_list_id: listId,
        name: ing.name.trim(),
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes,
        category_id: null,
        completed: false,
        sort_order,
      };
      sortBase = [
        ...sortBase,
        {
          id: "",
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
          category_id: null,
          completed: false,
          sort_order,
        },
      ];
      return row;
    });

    if (rows.length === 0) return { merged: 0, added: 0, total: 0 };

    const { error: insertError } = await supabase
      .from("shopping_items")
      .insert(rows);

    if (insertError) throw insertError;
    return { merged: 0, added: rows.length, total: rows.length };
  }

  const plan = planExportMerge(existingItems, filtered, (base) =>
    getNextSortOrderFromItems(base, null, false)
  );

  for (const update of plan.updates) {
    const { error } = await supabase
      .from("shopping_items")
      .update({ quantity: update.quantity, notes: update.notes })
      .eq("id", update.id);
    if (error) throw error;
  }

  if (plan.inserts.length > 0) {
    const rows = plan.inserts.map((row) => ({
      shopping_list_id: listId,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes,
      category_id: row.category_id,
      completed: row.completed,
      sort_order: row.sort_order,
    }));

    const { error: insertError } = await supabase
      .from("shopping_items")
      .insert(rows);

    if (insertError) throw insertError;
  }

  return {
    merged: plan.merged,
    added: plan.added,
    total: plan.merged + plan.added,
  };
}
