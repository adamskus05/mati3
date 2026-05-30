import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RecipeCategory,
  RecipeIngredient,
  RecipeIngredientInput,
  RecipeWithCategory,
  RecipeWithIngredients,
} from "@/lib/database.types";
import type { Json } from "@/lib/database.types.generated";

const RECIPE_SELECT = `
  *,
  recipe_category:recipe_categories (
    id,
    name,
    color
  )
`;

type RecipeRowWithJoin = RecipeWithCategory & {
  recipe_ingredients?: RecipeIngredient[];
};

function mapRecipeRow(row: RecipeRowWithJoin): RecipeWithCategory {
  const { recipe_category, ...recipe } = row;
  return {
    ...recipe,
    recipe_category: recipe_category ?? null,
  };
}

export async function fetchRecipes(
  supabase: SupabaseClient,
  householdId: string
): Promise<RecipeWithCategory[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_SELECT)
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapRecipeRow(row as RecipeRowWithJoin));
}

export async function fetchRecipe(
  supabase: SupabaseClient,
  recipeId: string
): Promise<RecipeWithIngredients | null> {
  const { data, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_SELECT}, recipe_ingredients(*)`)
    .eq("id", recipeId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as RecipeRowWithJoin;
  const ingredients = (row.recipe_ingredients ?? []) as RecipeIngredient[];
  ingredients.sort((a, b) => a.sort_order - b.sort_order);

  const { recipe_ingredients: _ignored, ...rest } = row;
  void _ignored;
  return {
    ...mapRecipeRow(rest as RecipeRowWithJoin),
    recipe_ingredients: ingredients,
  };
}

export type RecipeUpsertPayload = {
  title: string;
  source_url?: string | null;
  image_url?: string | null;
  recipe_category_id?: string | null;
  instructions: string[];
  ingredients: RecipeIngredientInput[];
};

export async function createRecipe(
  supabase: SupabaseClient,
  householdId: string,
  userId: string | null,
  payload: RecipeUpsertPayload
): Promise<RecipeWithIngredients> {
  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      title: payload.title.trim(),
      source_url: payload.source_url?.trim() || null,
      image_url: payload.image_url?.trim() || null,
      recipe_category_id: payload.recipe_category_id ?? null,
      instructions: payload.instructions as unknown as Json,
      created_by: userId,
    })
    .select(RECIPE_SELECT)
    .single();

  if (error) throw error;

  const ingredients = await insertIngredients(
    supabase,
    recipe.id,
    payload.ingredients
  );

  return { ...mapRecipeRow(recipe as RecipeRowWithJoin), recipe_ingredients: ingredients };
}

export async function updateRecipe(
  supabase: SupabaseClient,
  recipeId: string,
  payload: RecipeUpsertPayload
): Promise<RecipeWithIngredients> {
  const { data: recipe, error } = await supabase
    .from("recipes")
    .update({
      title: payload.title.trim(),
      source_url: payload.source_url?.trim() || null,
      image_url: payload.image_url?.trim() || null,
      recipe_category_id: payload.recipe_category_id ?? null,
      instructions: payload.instructions as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .select(RECIPE_SELECT)
    .single();

  if (error) throw error;

  const { error: delError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (delError) throw delError;

  const ingredients = await insertIngredients(
    supabase,
    recipeId,
    payload.ingredients
  );

  return { ...mapRecipeRow(recipe as RecipeRowWithJoin), recipe_ingredients: ingredients };
}

export async function deleteRecipe(
  supabase: SupabaseClient,
  recipeId: string
): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) throw error;
}

async function insertIngredients(
  supabase: SupabaseClient,
  recipeId: string,
  ingredients: RecipeIngredientInput[]
): Promise<RecipeIngredient[]> {
  const rows = ingredients
    .map((ing, index) => ({
      recipe_id: recipeId,
      name: ing.name.trim(),
      quantity: ing.quantity ?? null,
      unit: ing.unit?.trim() || null,
      notes: ing.notes?.trim() || null,
      section: ing.section?.trim() || null,
      sort_order: ing.sort_order ?? index,
    }))
    .filter((r) => r.name);

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("recipe_ingredients")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []).sort((a, b) => a.sort_order - b.sort_order);
}

export function instructionsFromJson(json: Json): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

export type { RecipeCategory };
