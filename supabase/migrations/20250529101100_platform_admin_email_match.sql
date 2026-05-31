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
