
CREATE OR REPLACE FUNCTION public.is_system_initialized()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::text = 'true' FROM public.app_settings WHERE key = 'setup_completed'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.complete_initial_setup(
  admin_user_id uuid,
  settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  v text;
  done boolean;
BEGIN
  SELECT COALESCE((SELECT value::text = 'true' FROM public.app_settings WHERE key = 'setup_completed'), false) INTO done;
  IF done THEN
    RAISE EXCEPTION 'System already initialized';
  END IF;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'admin_user_id is required';
  END IF;

  FOR k, v IN SELECT * FROM jsonb_each_text(settings)
  LOOP
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES (k, v, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END LOOP;

  INSERT INTO public.user_profiles (user_id)
  VALUES (admin_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 移除该用户的其他角色，确保仅为 super_admin
  DELETE FROM public.user_roles WHERE user_id = admin_user_id AND role <> 'super_admin'::public.app_role;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('setup_completed', 'true', now())
  ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
END;
$$;
