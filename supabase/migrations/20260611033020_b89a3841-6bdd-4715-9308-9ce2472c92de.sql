
-- 加固初始化保护：existence of super_admin 或 setup_completed 都阻止再次初始化；
-- 写入 initialized_at / initialized_by 审计字段。
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
  super_count integer;
BEGIN
  SELECT COALESCE((SELECT value::text = 'true' FROM public.app_settings WHERE key = 'setup_completed'), false) INTO done;
  IF done THEN
    RAISE EXCEPTION 'System already initialized' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO super_count FROM public.user_roles WHERE role = 'super_admin'::public.app_role;
  IF super_count > 0 THEN
    RAISE EXCEPTION 'Super admin already exists; initialization is locked' USING ERRCODE = '42501';
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

-- 唯一性保护：确保整张表最多只有一条 super_admin 记录
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_only_one_super_admin
  ON public.user_roles ((role))
  WHERE role = 'super_admin'::public.app_role;
