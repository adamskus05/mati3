-- Run this if 20250529100400 stopped partway (e.g. policy already exists).
-- Safe to run multiple times.

-- RLS
DROP POLICY IF EXISTS "household_events_select" ON public.household_events;
CREATE POLICY "household_events_select" ON public.household_events
  FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "households_update_member" ON public.households;
DROP POLICY IF EXISTS "households_update_owner" ON public.households;
CREATE POLICY "households_update_owner" ON public.households
  FOR UPDATE TO authenticated
  USING (public.is_household_owner(id))
  WITH CHECK (public.is_household_owner(id));

DROP POLICY IF EXISTS "household_members_delete_owner" ON public.household_members;
CREATE POLICY "household_members_delete_owner" ON public.household_members
  FOR DELETE TO authenticated
  USING (
    public.is_household_owner(household_id)
    AND user_id <> auth.uid()
  );

DROP POLICY IF EXISTS "household_members_update_owner" ON public.household_members;
CREATE POLICY "household_members_update_owner" ON public.household_members
  FOR UPDATE TO authenticated
  USING (public.is_household_owner(household_id))
  WITH CHECK (public.is_household_owner(household_id));

-- Realtime
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'household_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_events;
  END IF;
END $body$;

-- RPC: remove member (if missing)
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

GRANT EXECUTE ON FUNCTION public.renew_household_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_household_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner(uuid) TO authenticated;
