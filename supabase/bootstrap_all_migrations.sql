-- Mati: kör HELA denna fil i Supabase SQL Editor (samma projekt som NEXT_PUBLIC_SUPABASE_URL).
-- Tom databas: skapar allt. Befintlig Mati-databas: hoppa över om tabeller redan finns (kan ge fel vid dubletter).


-- =============================================================================
-- 20250529100000_initial_schema.sql
-- =============================================================================
-- Mati initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Households
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE INDEX idx_household_members_user ON public.household_members(user_id);
CREATE INDEX idx_household_members_household ON public.household_members(household_id);

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B9B7A',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_household ON public.categories(household_id);

-- Shopping lists
CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_shopping_lists_household ON public.shopping_lists(household_id);
CREATE INDEX idx_shopping_lists_active ON public.shopping_lists(household_id) WHERE deleted_at IS NULL;

-- Shopping items
CREATE TABLE public.shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric,
  unit text,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopping_items_list ON public.shopping_items(shopping_list_id);
CREATE INDEX idx_shopping_items_category ON public.shopping_items(category_id);

-- Item presets (quick buttons per household)
CREATE TABLE public.item_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_quantity numeric,
  default_unit text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_presets_household ON public.item_presets(household_id);

-- Invite code generator
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  attempts integer := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..7 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = result);
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique invite code';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Create household RPC
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

  INSERT INTO public.household_members (household_id, user_id)
  VALUES (v_household.id, v_uid);

  RETURN v_household;
END;
$$;

-- Join household by invite code
CREATE OR REPLACE FUNCTION public.join_household_by_code(p_code text)
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

  SELECT * INTO v_household
  FROM public.households
  WHERE invite_code = upper(trim(p_code));

  IF v_household.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.household_members (household_id, user_id)
  VALUES (v_household.id, v_uid)
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN v_household;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(text) TO authenticated;


-- =============================================================================
-- 20250529100100_rls_policies.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529100200_triggers.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529100300_profiles_household_peers.sql
-- =============================================================================
-- Household members may read profiles of other members in the same household
-- (required for members list and list creator display names).

CREATE POLICY "profiles_select_household_peers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members AS mine
      INNER JOIN public.household_members AS peer
        ON mine.household_id = peer.household_id
      WHERE mine.user_id = auth.uid()
        AND peer.user_id = profiles.id
    )
  );


-- =============================================================================
-- 20250529100400_household_roles_events.sql
-- =============================================================================
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
-- RLS (idempotent — safe to re-run)
-- ---------------------------------------------------------------------------
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

-- Realtime (skip if already added)
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


-- =============================================================================
-- 20250529100500_household_roles_finish.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529100600_collab_lists_offline_push.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529100700_recipes.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529100800_recipe_ingredient_sections.sql
-- =============================================================================
-- Group labels for recipe ingredients (e.g. "Biffar", "Tzatziki")

ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS section text;


-- =============================================================================
-- 20250529100900_recipe_categories.sql
-- =============================================================================
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


-- =============================================================================
-- 20250529101000_signup_access_control.sql
-- =============================================================================
-- Platform admins and controlled signup (request + approve + invite)

CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT platform_admins_email_lower CHECK (email = lower(email)),
  CONSTRAINT platform_admins_email_unique UNIQUE (email)
);

CREATE INDEX idx_platform_admins_user ON public.platform_admins(user_id);

CREATE TYPE public.signup_request_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'invited'
);

CREATE TABLE public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  message text,
  status public.signup_request_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  CONSTRAINT signup_requests_email_lower CHECK (email = lower(email))
);

CREATE INDEX idx_signup_requests_status ON public.signup_requests(status);
CREATE INDEX idx_signup_requests_email ON public.signup_requests(lower(email));

CREATE UNIQUE INDEX signup_requests_one_pending_per_email
  ON public.signup_requests (email)
  WHERE status = 'pending';

-- Link platform admin row when invited user completes signup
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

  UPDATE public.platform_admins
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "platform_admins_insert" ON public.platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform_admins_delete" ON public.platform_admins
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "signup_requests_select" ON public.signup_requests
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "signup_requests_update" ON public.signup_requests
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());


-- =============================================================================
-- 20250529101100_platform_admin_email_match.sql
-- =============================================================================
-- Match platform admin by JWT email when user_id was not linked yet (pre-existing accounts)

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  IF v_email <> '' AND EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE email = v_email AND user_id IS NULL
  ) THEN
    UPDATE public.platform_admins
    SET user_id = v_uid
    WHERE email = v_email AND user_id IS NULL;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- =============================================================================
-- 20250529120000_search_household.sql
-- =============================================================================
-- Global household search (recipes, lists, items, categories)
-- Requires: 20250529100000_initial_schema.sql and is_household_member (20250529100100+)

DO $guard$
BEGIN
  IF to_regclass('public.households') IS NULL THEN
    RAISE EXCEPTION
      'Saknar public.households. Kör alla migrationer från 20250529100000_initial_schema.sql först (t.ex. supabase db push).';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.search_household(
  p_household_id uuid,
  p_query text,
  p_limit int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern text;
  v_limit int;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'Not a household member';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50);
  v_pattern := '%' || trim(COALESCE(p_query, '')) || '%';

  IF length(trim(COALESCE(p_query, ''))) < 1 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(sub.row ORDER BY sub.row->>'kind', sub.row->>'title'), '[]'::jsonb)
  INTO v_results
  FROM (
    (
      SELECT jsonb_build_object(
        'kind', 'recipe',
        'id', r.id,
        'title', r.title,
        'subtitle', rc.name,
        'href', '/h/' || p_household_id::text || '/recipes/' || r.id::text
      ) AS row
      FROM public.recipes r
      LEFT JOIN public.recipe_categories rc ON rc.id = r.recipe_category_id
      WHERE r.household_id = p_household_id
        AND r.title ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'list',
        'id', sl.id,
        'title', sl.name,
        'subtitle', 'Inköpslista',
        'href', '/h/' || p_household_id::text || '/lists/' || sl.id::text
      ) AS row
      FROM public.shopping_lists sl
      WHERE sl.household_id = p_household_id
        AND sl.deleted_at IS NULL
        AND sl.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'item',
        'id', si.id,
        'title', si.name,
        'subtitle', sl.name,
        'href', '/h/' || p_household_id::text || '/lists/' || sl.id::text
      ) AS row
      FROM public.shopping_items si
      JOIN public.shopping_lists sl ON sl.id = si.shopping_list_id
      WHERE sl.household_id = p_household_id
        AND sl.deleted_at IS NULL
        AND si.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'category',
        'id', c.id,
        'title', c.name,
        'subtitle', 'Listkategori',
        'href', '/h/' || p_household_id::text || '/categories'
      ) AS row
      FROM public.categories c
      WHERE c.household_id = p_household_id
        AND c.name ILIKE v_pattern
      LIMIT v_limit
    )
    UNION ALL
    (
      SELECT jsonb_build_object(
        'kind', 'recipe_category',
        'id', rc.id,
        'title', rc.name,
        'subtitle', 'Receptkategori',
        'href', '/h/' || p_household_id::text || '/recipes'
      ) AS row
      FROM public.recipe_categories rc
      WHERE rc.household_id = p_household_id
        AND rc.name ILIKE v_pattern
      LIMIT v_limit
    )
  ) sub
  LIMIT v_limit;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_household(uuid, text, int) TO authenticated;


-- =============================================================================
-- 20250529120100_household_audit_log.sql
-- =============================================================================
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

