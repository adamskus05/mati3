-- Partner signals + push reliability
-- 1) created_by on shopping items
-- 2) log list_items_added on insert
-- 3) UPDATE policy for push_subscriptions upsert

ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_items_created_by
  ON public.shopping_items (created_by);

-- Default creator on insert when authenticated
CREATE OR REPLACE FUNCTION public.set_shopping_item_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_item_created_by ON public.shopping_items;
CREATE TRIGGER trg_shopping_item_created_by
  BEFORE INSERT ON public.shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shopping_item_created_by();

-- Activity + push: new item on a list
CREATE OR REPLACE FUNCTION public.log_shopping_item_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hid uuid;
  lname text;
BEGIN
  SELECT sl.household_id, sl.name
  INTO hid, lname
  FROM public.shopping_lists sl
  WHERE sl.id = NEW.shopping_list_id;

  IF hid IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_household_event(
    hid,
    'list_items_added',
    jsonb_build_object(
      'list_id', NEW.shopping_list_id,
      'list_name', lname,
      'item_id', NEW.id,
      'item_name', NEW.name
    ),
    COALESCE(NEW.created_by, auth.uid())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_item_added_event ON public.shopping_items;
CREATE TRIGGER trg_shopping_item_added_event
  AFTER INSERT ON public.shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_shopping_item_added();

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
