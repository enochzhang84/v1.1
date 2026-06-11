CREATE OR REPLACE FUNCTION public.complete_initial_setup(admin_user_id uuid, settings jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  k text;
  v text;
  done boolean;
  existing_super uuid;
BEGIN
  SELECT COALESCE((SELECT value::text = 'true' FROM public.app_settings WHERE key = 'setup_completed'), false) INTO done;
  IF done THEN
    RAISE EXCEPTION 'System already initialized' USING ERRCODE = '42501';
  END IF;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'admin_user_id is required';
  END IF;

  -- 允许首次或同一位 super_admin 继续完成向导；禁止替换为另一位用户。
  SELECT user_id INTO existing_super FROM public.user_roles WHERE role = 'super_admin'::public.app_role LIMIT 1;
  IF existing_super IS NOT NULL AND existing_super <> admin_user_id THEN
    RAISE EXCEPTION 'Super admin already exists; only the existing super admin may continue setup' USING ERRCODE = '42501';
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

  DELETE FROM public.user_roles WHERE user_id = admin_user_id AND role <> 'super_admin'::public.app_role;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.app_settings (key, value, updated_at) VALUES
    ('setup_completed', 'true', now()),
    ('system_initialized', 'true', now()),
    ('initialized_at', now()::text, now()),
    ('initialized_by', admin_user_id::text, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$function$;