-- Triggers and profile bootstrap

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER shopping_items_updated_at
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- New user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Validate category belongs to same household as shopping list
CREATE OR REPLACE FUNCTION public.check_item_category_household()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_list_household uuid;
  v_cat_household uuid;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT household_id INTO v_list_household
  FROM public.shopping_lists WHERE id = NEW.shopping_list_id;

  SELECT household_id INTO v_cat_household
  FROM public.categories WHERE id = NEW.category_id;

  IF v_list_household IS DISTINCT FROM v_cat_household THEN
    RAISE EXCEPTION 'Category does not belong to the same household as the list';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shopping_items_category_check
  BEFORE INSERT OR UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.check_item_category_household();
