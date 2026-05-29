-- Roles, leave household, renew invite code, activity log

-- ---------------------------------------------------------------------------
-- Roles on household_members
-- ---------------------------------------------------------------------------
ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'member'));

-- One owner per household (earliest member) for existing rows
UPDATE public.household_members hm
SET role = 'owner'
FROM (
  SELECT DISTINCT ON (household_id) id AS member_id
  FROM public.household_members
  ORDER BY household_id, joined_at ASC, id ASC
) AS firsts
WHERE hm.id = firsts.member_id
  AND hm.role <> 'owner';

CREATE INDEX IF NOT EXISTS idx_household_members_role
  ON public.household_members (household_id, role);

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_events_household_created
  ON public.household_events (household_id, created_at DESC);

ALTER TABLE public.household_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.log_household_event(
  p_household_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.household_events (household_id, actor_id, event_type, metadata)
  VALUES (p_household_id, p_actor_id, p_event_type, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: renew invite code (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renew_household_invite_code(p_household_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Endast ägaren kan förnya inbjudningskoden';
  END IF;

  v_code := public.generate_invite_code();

  UPDATE public.households
  SET invite_code = v_code
  WHERE id = p_household_id;

  PERFORM public.log_household_event(
    p_household_id,
    'invite_code_renewed',
    '{}'::jsonb
  );

  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: transfer ownership (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_household_ownership(
  p_household_id uuid,
  p_new_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Endast ägaren kan överföra ägarskap';
  END IF;

  IF p_new_owner_user_id = v_uid THEN
    RAISE EXCEPTION 'Du är redan ägare';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = p_new_owner_user_id
  ) THEN
    RAISE EXCEPTION 'Användaren är inte medlem i hushållet';
  END IF;

  UPDATE public.household_members
  SET role = 'member'
  WHERE household_id = p_household_id AND user_id = v_uid;

  UPDATE public.household_members
  SET role = 'owner'
  WHERE household_id = p_household_id AND user_id = p_new_owner_user_id;

  PERFORM public.log_household_event(
    p_household_id,
    'ownership_transferred',
    jsonb_build_object('new_owner_user_id', p_new_owner_user_id)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: leave household
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_household(p_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_member_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM public.household_members
  WHERE household_id = p_household_id AND user_id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Du är inte medlem i detta hushåll';
  END IF;

  SELECT count(*)::integer INTO v_member_count
  FROM public.household_members
  WHERE household_id = p_household_id;

  IF v_role = 'owner' AND v_member_count > 1 THEN
    RAISE EXCEPTION 'Överför ägarskap till en annan medlem innan du lämnar hushållet';
  END IF;

  IF v_role = 'owner' AND v_member_count = 1 THEN
    PERFORM public.log_household_event(
      p_household_id,
      'household_deleted',
      '{}'::jsonb
    );
    DELETE FROM public.households WHERE id = p_household_id;
    RETURN;
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = v_uid;

  PERFORM public.log_household_event(
    p_household_id,
    'member_left',
    jsonb_build_object('user_id', v_uid),
    v_uid
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Update create / join household
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_household(p_name text)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household public.households;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.households (name, invite_code)
  VALUES (p_name, public.generate_invite_code())
  RETURNING * INTO v_household;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_household.id, v_uid, 'owner');

  PERFORM public.log_household_event(
    v_household.id,
    'household_created',
    jsonb_build_object('household_name', v_household.name)
  );

  RETURN v_household;
END;
$$;

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
-- List activity triggers
-- ---------------------------------------------------------------------------
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
      jsonb_build_object('list_id', NEW.id, 'list_name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopping_lists_activity ON public.shopping_lists;
CREATE TRIGGER shopping_lists_activity
  AFTER INSERT OR UPDATE OF deleted_at ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.log_shopping_list_events();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
CREATE POLICY "household_events_select" ON public.household_events
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "households_update_member" ON public.households;

CREATE POLICY "households_update_owner" ON public.households
  FOR UPDATE TO authenticated
  USING (public.is_household_owner(id))
  WITH CHECK (public.is_household_owner(id));

-- Owners may remove other members (not themselves via this policy)
CREATE POLICY "household_members_delete_owner" ON public.household_members
  FOR DELETE TO authenticated
  USING (
    public.is_household_owner(household_id)
    AND user_id <> auth.uid()
  );

CREATE POLICY "household_members_update_owner" ON public.household_members
  FOR UPDATE TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_events;

GRANT EXECUTE ON FUNCTION public.renew_household_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_household_ownership(uuid, uuid) TO authenticated;
-- ---------------------------------------------------------------------------
-- RPC: remove member (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'Endast ägaren kan ta bort medlemmar';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Använd leave_household för att lämna själv';
  END IF;

  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medlemmen hittades inte';
  END IF;

  PERFORM public.log_household_event(
    p_household_id,
    'member_removed',
    jsonb_build_object('user_id', p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;
