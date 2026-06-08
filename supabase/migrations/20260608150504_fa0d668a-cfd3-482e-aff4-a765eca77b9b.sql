DROP POLICY IF EXISTS "admins manage fellowships" ON public.fellowships;
DROP POLICY IF EXISTS "admins read all fellowships" ON public.fellowships;

CREATE POLICY "admins manage fellowships" ON public.fellowships
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "admins read all fellowships" ON public.fellowships
  FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));