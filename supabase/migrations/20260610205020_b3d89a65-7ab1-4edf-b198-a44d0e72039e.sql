-- registrations 缺少表级 GRANT，RLS 策略再宽也会先被 PG 权限挡住，导致 42501。
-- 补齐 anon (INSERT) / authenticated (全) / service_role (全) 的表级授权。
GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

-- 同步给联动表补齐 authenticated/service_role 授权（autoflow 触发器以 SECURITY DEFINER 运行无需 anon）。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_join_records TO authenticated;
GRANT ALL ON public.group_join_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;

-- 补齐管理员 SELECT 策略（当前只有 worker_in_area 可读，is_admin_or_above 不一定隶属 newcomer 服务区）。
DROP POLICY IF EXISTS "admins select registrations" ON public.registrations;
CREATE POLICY "admins select registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (public.is_admin_or_above(auth.uid()));