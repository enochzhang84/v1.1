DROP POLICY IF EXISTS "admins manage class schedule" ON public.sunday_class_schedule;
CREATE POLICY "admins manage class schedule" ON public.sunday_class_schedule
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));