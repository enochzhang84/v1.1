-- Ensure admin-level policies include both super_admin and admin, without opening private lists to anonymous users.

DROP POLICY IF EXISTS "admins read retreat" ON public.retreat_registrations;
DROP POLICY IF EXISTS "admins update retreat" ON public.retreat_registrations;
DROP POLICY IF EXISTS "admins delete retreat" ON public.retreat_registrations;
CREATE POLICY "admins read retreat"
  ON public.retreat_registrations
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins update retreat"
  ON public.retreat_registrations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete retreat"
  ON public.retreat_registrations
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read fellowship checkins" ON public.fellowship_checkins;
DROP POLICY IF EXISTS "admins delete fellowship checkins" ON public.fellowship_checkins;
CREATE POLICY "admins read fellowship checkins"
  ON public.fellowship_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete fellowship checkins"
  ON public.fellowship_checkins
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read service applications" ON public.service_applications;
DROP POLICY IF EXISTS "admins update service applications" ON public.service_applications;
DROP POLICY IF EXISTS "admins delete service applications" ON public.service_applications;
CREATE POLICY "admins read service applications"
  ON public.service_applications
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins update service applications"
  ON public.service_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete service applications"
  ON public.service_applications
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read feedback" ON public.feedbacks;
DROP POLICY IF EXISTS "admins delete feedback" ON public.feedbacks;
CREATE POLICY "admins read feedback"
  ON public.feedbacks
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete feedback"
  ON public.feedbacks
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read adult class checkins" ON public.adult_class_checkins;
DROP POLICY IF EXISTS "admins delete adult class checkins" ON public.adult_class_checkins;
CREATE POLICY "admins read adult class checkins"
  ON public.adult_class_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete adult class checkins"
  ON public.adult_class_checkins
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins manage service_projects" ON public.service_projects;
CREATE POLICY "admins manage service_projects"
  ON public.service_projects
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins manage events" ON public.events;
CREATE POLICY "admins manage events"
  ON public.events
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));