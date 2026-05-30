-- Recipe categories per household (separate from shopping item categories)

CREATE TABLE public.recipe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7BA3C9',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_categories_household ON public.recipe_categories(household_id);

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS recipe_category_id uuid
  REFERENCES public.recipe_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_recipes_category ON public.recipes(recipe_category_id);

ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_categories_select" ON public.recipe_categories
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "recipe_categories_insert" ON public.recipe_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "recipe_categories_update" ON public.recipe_categories
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "recipe_categories_delete" ON public.recipe_categories
  FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_categories;
