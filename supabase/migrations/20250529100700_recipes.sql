-- Recipes per household

CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_url text,
  image_url text,
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_household ON public.recipes(household_id);
CREATE INDEX idx_recipes_updated ON public.recipes(household_id, updated_at DESC);

CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric,
  unit text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);

CREATE OR REPLACE FUNCTION public.get_recipe_household_id(p_recipe_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.recipes WHERE id = p_recipe_id;
$$;

CREATE OR REPLACE FUNCTION public.touch_recipe_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.recipes SET updated_at = now() WHERE id = NEW.recipe_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recipe_ingredients_touch_recipe
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_recipe_updated_at();

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select" ON public.recipes
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "recipes_insert" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "recipes_update" ON public.recipes
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "recipes_delete" ON public.recipes
  FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "recipe_ingredients_select" ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (public.is_household_member(public.get_recipe_household_id(recipe_id)));

CREATE POLICY "recipe_ingredients_insert" ON public.recipe_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(public.get_recipe_household_id(recipe_id)));

CREATE POLICY "recipe_ingredients_update" ON public.recipe_ingredients
  FOR UPDATE TO authenticated
  USING (public.is_household_member(public.get_recipe_household_id(recipe_id)))
  WITH CHECK (public.is_household_member(public.get_recipe_household_id(recipe_id)));

CREATE POLICY "recipe_ingredients_delete" ON public.recipe_ingredients
  FOR DELETE TO authenticated
  USING (public.is_household_member(public.get_recipe_household_id(recipe_id)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_ingredients;
