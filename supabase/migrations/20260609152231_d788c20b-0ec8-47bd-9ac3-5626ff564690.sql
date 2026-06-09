CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_roles integer;
  new_role public.app_role;
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 严格规则：仅当 user_roles 完全为空时，才允许把新用户自动设为首位 super_admin。
  -- 一旦表中存在任何角色（包括 viewer），后续新注册用户一律为 viewer，避免把
  -- 已经有管理员的系统误判为「首次初始化」。
  SELECT count(*) INTO total_roles FROM public.user_roles;

  IF total_roles = 0 THEN
    new_role := 'super_admin'::public.app_role;
  ELSE
    new_role := 'viewer'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, new_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;