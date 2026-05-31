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
