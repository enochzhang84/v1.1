
-- 1) system_notifications: restrict SELECT to authenticated (creator_name contains email)
DROP POLICY IF EXISTS "anyone read system_notifications" ON public.system_notifications;
CREATE POLICY "authenticated read system_notifications"
  ON public.system_notifications
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2) realtime.messages: deny anon, allow authenticated
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated can use realtime" ON realtime.messages';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "authenticated can use realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN others THEN NULL; END $$;

-- 3) av_notes: add SELECT for admins and media workers
CREATE POLICY "admins read av_notes"
  ON public.av_notes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "media workers read av_notes"
  ON public.av_notes FOR SELECT TO authenticated
  USING (worker_in_area(auth.uid(), 'media'::text));

-- 4) duty_schedules + duty_personnel: allow authenticated read
CREATE POLICY "authenticated read duty_schedules"
  ON public.duty_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read duty_personnel"
  ON public.duty_personnel FOR SELECT TO authenticated USING (true);

-- 5) Revoke anon EXECUTE on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.can_view_analytics(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_service_area(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_above(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.worker_in_area(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_table_columns_info(text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_table_policies_info(text[]) FROM anon;
