-- RLS helpers and policies

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_item_household_id(p_list_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.shopping_lists WHERE id = p_list_id;
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_presets ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Households
CREATE POLICY "households_select_member" ON public.households
  FOR SELECT TO authenticated USING (public.is_household_member(id));

CREATE POLICY "households_insert_authenticated" ON public.households
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "households_update_member" ON public.households
  FOR UPDATE TO authenticated
  USING (public.is_household_member(id))
  WITH CHECK (public.is_household_member(id));

-- Household members
CREATE POLICY "household_members_select" ON public.household_members
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));

CREATE POLICY "household_members_insert_self" ON public.household_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "household_members_delete_self" ON public.household_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Categories
CREATE POLICY "categories_select" ON public.categories
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));

CREATE POLICY "categories_insert" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "categories_update" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "categories_delete" ON public.categories
  FOR DELETE TO authenticated USING (public.is_household_member(household_id));

-- Shopping lists
CREATE POLICY "shopping_lists_select" ON public.shopping_lists
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));

CREATE POLICY "shopping_lists_insert" ON public.shopping_lists
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "shopping_lists_update" ON public.shopping_lists
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "shopping_lists_delete" ON public.shopping_lists
  FOR DELETE TO authenticated USING (public.is_household_member(household_id));

-- Shopping items (via list household)
CREATE POLICY "shopping_items_select" ON public.shopping_items
  FOR SELECT TO authenticated
  USING (public.is_household_member(public.get_item_household_id(shopping_list_id)));

CREATE POLICY "shopping_items_insert" ON public.shopping_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(public.get_item_household_id(shopping_list_id)));

CREATE POLICY "shopping_items_update" ON public.shopping_items
  FOR UPDATE TO authenticated
  USING (public.is_household_member(public.get_item_household_id(shopping_list_id)))
  WITH CHECK (public.is_household_member(public.get_item_household_id(shopping_list_id)));

CREATE POLICY "shopping_items_delete" ON public.shopping_items
  FOR DELETE TO authenticated
  USING (public.is_household_member(public.get_item_household_id(shopping_list_id)));

-- Item presets
CREATE POLICY "item_presets_select" ON public.item_presets
  FOR SELECT TO authenticated USING (public.is_household_member(household_id));

CREATE POLICY "item_presets_insert" ON public.item_presets
  FOR INSERT TO authenticated WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "item_presets_update" ON public.item_presets
  FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "item_presets_delete" ON public.item_presets
  FOR DELETE TO authenticated USING (public.is_household_member(household_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_presets;
