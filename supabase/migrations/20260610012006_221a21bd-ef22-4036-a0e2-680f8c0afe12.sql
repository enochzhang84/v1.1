
-- HOC3 V2.0 首次系统开通向导：RPC + 默认值

-- 标记设置（如果尚未存在，写入默认 false；幂等）
INSERT INTO public.app_settings (key, value)
VALUES ('setup_completed', 'false')
ON CONFLICT (key) DO NOTHING;

-- 判断系统是否已初始化（anon 可调用）
CREATE OR REPLACE FUNCTION public.is_system_initialized()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT value::text = 'true' FROM public.app_settings WHERE key = 'setup_completed'),
      false
    )
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.is_system_initialized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_system_initialized() TO anon, authenticated, service_role;

-- 完成首次系统开通（anon 可调用，但内部会再次校验未初始化）
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
BEGIN
  -- 再次校验未初始化
  IF public.is_system_initialized() THEN
    RAISE EXCEPTION 'System already initialized';
  END IF;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'admin_user_id is required';
  END IF;

  -- 写入所有设置
  FOR k, v IN SELECT * FROM jsonb_each_text(settings)
  LOOP
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES (k, v, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END LOOP;

  -- 兜底：确保该用户拥有 super_admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_profiles (user_id)
  VALUES (admin_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 标记开通完成
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('setup_completed', 'true', now())
  ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_initial_setup(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_setup(uuid, jsonb) TO anon, authenticated, service_role;

-- 教会资料 / 认证设置 公开读取（前端在未登录时也需要读取 auth_base_url、教会名等用于邮件展示）
-- 只允许读取白名单 key
CREATE OR REPLACE FUNCTION public.get_public_app_settings()
RETURNS TABLE(key text, value text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, value FROM public.app_settings
  WHERE key IN (
    'church_name_cn','church_name_en','church_phone','church_email','church_website',
    'church_address','sunday_service_time',
    'auth_base_url','email_sender_name','reply_to_email',
    'admin_logo_title_zh','admin_logo_title_en','admin_logo_version',
    'setup_completed'
  );
$$;
REVOKE ALL ON FUNCTION public.get_public_app_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_app_settings() TO anon, authenticated, service_role;
