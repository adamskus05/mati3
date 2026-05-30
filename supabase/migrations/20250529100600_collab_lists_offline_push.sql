-- Collaboration, list ordering, offline/push prep, rate limiting

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.shopping_items
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS shopper_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shopper_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.shopping_lists sl
SET sort_order = sub.rn
FROM (
  SELECT id, (row_number() OVER (
    PARTITION BY household_id
    ORDER BY updated_at DESC, created_at DESC
  ) - 1)::integer AS rn
  FROM public.shopping_lists
  WHERE deleted_at IS NULL
) AS sub
WHERE sl.id = sub.id AND sl.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_sort
  ON public.shopping_lists (household_id, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Rate limit join attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_join_attempts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id)
);

ALTER TABLE public.household_join_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Push subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- User preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Rate limit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_join_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_window timestamptz;
  v_max_attempts constant integer := 10;
  v_window_minutes constant integer := 15;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT attempt_count, window_start
  INTO v_count, v_window
  FROM public.household_join_attempts
  WHERE user_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.household_join_attempts (user_id, attempt_count, window_start)
    VALUES (v_uid, 1, now());
    RETURN;
  END IF;

  IF v_window < now() - (v_window_minutes || ' minutes')::interval THEN
    UPDATE public.household_join_attempts
    SET attempt_count = 1, window_start = now()
    WHERE user_id = v_uid;
    RETURN;
  END IF;

  IF v_count >= v_max_attempts THEN
    RAISE EXCEPTION 'För många försök. Vänta % minuter och försök igen.', v_window_minutes
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.household_join_attempts
  SET attempt_count = attempt_count + 1
  WHERE user_id = v_uid;
END;
$$;

-- ---------------------------------------------------------------------------
-- Update join with rate limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_household_by_code(p_code text)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household public.households;
  v_uid uuid := auth.uid();
  v_new_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.check_join_rate_limit();

  SELECT * INTO v_household
  FROM public.households
  WHERE invite_code = upper(trim(p_code));

  IF v_household.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_household.id, v_uid, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING
  RETURNING id INTO v_new_member_id;

  IF v_new_member_id IS NOT NULL THEN
    PERFORM public.log_household_event(
      v_household.id,
      'member_joined',
      jsonb_build_object('user_id', v_uid)
    );
  END IF;

  RETURN v_household;
END;
$$;

-- ---------------------------------------------------------------------------
-- Household rename
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_household_name(
  p_household_id uuid,
  p_name text
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household public.households;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Endast ägaren kan byta namn på hushållet';
  END IF;

  IF length(trim(p_name)) < 1 THEN
    RAISE EXCEPTION 'Namnet får inte vara tomt';
  END IF;

  UPDATE public.households
  SET name = trim(p_name)
  WHERE id = p_household_id
  RETURNING * INTO v_household;

  PERFORM public.log_household_event(
    p_household_id,
    'household_renamed',
    jsonb_build_object('household_name', v_household.name)
  );

  RETURN v_household;
END;
$$;

-- ---------------------------------------------------------------------------
-- List shopper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_list_shopper(p_list_id uuid)
RETURNS public.shopping_lists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.shopping_lists;
  v_household_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_list FROM public.shopping_lists WHERE id = p_list_id;
  IF v_list.id IS NULL THEN
    RAISE EXCEPTION 'Listan hittades inte';
  END IF;

  v_household_id := v_list.household_id;

  IF NOT public.is_household_member(v_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  UPDATE public.shopping_lists
  SET shopper_id = auth.uid(), shopper_started_at = now()
  WHERE id = p_list_id
  RETURNING * INTO v_list;

  PERFORM public.log_household_event(
    v_household_id,
    'shopping_started',
    jsonb_build_object('list_id', p_list_id, 'list_name', v_list.name)
  );

  RETURN v_list;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_list_shopper(p_list_id uuid)
RETURNS public.shopping_lists
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.shopping_lists;
  v_household_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_list FROM public.shopping_lists WHERE id = p_list_id;
  IF v_list.id IS NULL THEN
    RAISE EXCEPTION 'Listan hittades inte';
  END IF;

  v_household_id := v_list.household_id;

  IF NOT public.is_household_member(v_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  IF v_list.shopper_id IS DISTINCT FROM auth.uid()
    AND NOT public.is_household_owner(v_household_id) THEN
    RAISE EXCEPTION 'Endast den som handlar eller ägaren kan avsluta';
  END IF;

  UPDATE public.shopping_lists
  SET shopper_id = NULL, shopper_started_at = NULL
  WHERE id = p_list_id
  RETURNING * INTO v_list;

  PERFORM public.log_household_event(
    v_household_id,
    'shopping_ended',
    jsonb_build_object('list_id', p_list_id, 'list_name', v_list.name)
  );

  RETURN v_list;
END;
$$;

-- ---------------------------------------------------------------------------
-- Archive list sets deleted_by (BEFORE trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_list_deleted_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.deleted_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopping_lists_set_deleted_by ON public.shopping_lists;
CREATE TRIGGER shopping_lists_set_deleted_by
  BEFORE UPDATE OF deleted_at ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_list_deleted_by();

-- Extend list archive event metadata
CREATE OR REPLACE FUNCTION public.log_shopping_list_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_household_event(
      NEW.household_id,
      'list_created',
      jsonb_build_object('list_id', NEW.id, 'list_name', NEW.name)
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.log_household_event(
      NEW.household_id,
      'list_archived',
      jsonb_build_object(
        'list_id', NEW.id,
        'list_name', NEW.name,
        'deleted_by', NEW.deleted_by
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_upsert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_upsert_own" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT EXECUTE ON FUNCTION public.update_household_name(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_list_shopper(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_list_shopper(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_join_rate_limit() TO authenticated;
