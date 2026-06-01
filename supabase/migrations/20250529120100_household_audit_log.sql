-- Technical audit log (owner-only) separate from user-facing household_events
-- Requires: 20250529100000_initial_schema.sql and 20250529100400_household_roles_events.sql

DO $guard$
BEGIN
  IF to_regclass('public.households') IS NULL THEN
    RAISE EXCEPTION
      'Saknar public.households. Kör alla migrationer från 20250529100000_initial_schema.sql först (t.ex. supabase db push).';
  END IF;
  IF to_regprocedure('public.is_household_owner(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Saknar is_household_owner. Kör 20250529100400_household_roles_events.sql först.';
  END IF;
END
$guard$;

CREATE TABLE IF NOT EXISTS public.household_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_audit_log_household_created
  ON public.household_audit_log (household_id, created_at DESC);

ALTER TABLE public.household_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_household_audit(
  p_household_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.household_audit_log (
    household_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_household_id,
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

DROP POLICY IF EXISTS "household_audit_log_select_owner" ON public.household_audit_log;
CREATE POLICY "household_audit_log_select_owner" ON public.household_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_household_owner(household_id));

-- Renew invite: audit only (not activity feed)
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

  PERFORM public.log_household_audit(
    p_household_id,
    'invite_code_renewed',
    'invite',
    p_household_id::text,
    '{}'::jsonb
  );

  RETURN v_code;
END;
$$;

-- Transfer ownership: audit only
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

  PERFORM public.log_household_audit(
    p_household_id,
    'ownership_transferred',
    'member',
    p_new_owner_user_id::text,
    jsonb_build_object('new_owner_user_id', p_new_owner_user_id)
  );
END;
$$;

-- Remove member: audit only (not activity feed)
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

  PERFORM public.log_household_audit(
    p_household_id,
    'member_removed',
    'member',
    p_user_id::text,
    jsonb_build_object('user_id', p_user_id)
  );
END;
$$;
