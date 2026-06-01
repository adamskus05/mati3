-- Household-wide default portion scale (does not mutate base ingredient quantities)

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS scale_anchor_ingredient_id uuid
    REFERENCES public.recipe_ingredients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scale_new_quantity numeric;

COMMENT ON COLUMN public.recipes.scale_anchor_ingredient_id IS
  'Anchor ingredient for default scale preset; cleared if ingredient deleted.';
COMMENT ON COLUMN public.recipes.scale_new_quantity IS
  'Target quantity for anchor when applying household scale preset.';
