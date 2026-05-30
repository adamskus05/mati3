-- Group labels for recipe ingredients (e.g. "Biffar", "Tzatziki")

ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS section text;
