-- Public page settings are public website configuration, not private registration lists.
GRANT SELECT ON public.home_page_settings TO anon;
GRANT SELECT (id, name, qr_token, is_active, created_at) ON public.events TO anon;

-- Tighten Sunday school public QR permissions while preserving public course options and check-in submission.
REVOKE SELECT, UPDATE, DELETE ON public.sunday_school_checkins FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.sunday_school_courses FROM anon;
REVOKE SELECT ON public.sunday_school_courses FROM anon;
GRANT INSERT ON public.sunday_school_checkins TO anon;
GRANT SELECT (id, name, sort_order, is_active) ON public.sunday_school_courses TO anon;

DROP POLICY IF EXISTS "admins read checkins" ON public.sunday_school_checkins;
DROP POLICY IF EXISTS "admins delete checkins" ON public.sunday_school_checkins;
CREATE POLICY "admins read checkins"
  ON public.sunday_school_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins delete checkins"
  ON public.sunday_school_checkins
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

DROP POLICY IF EXISTS "admins read all courses" ON public.sunday_school_courses;
DROP POLICY IF EXISTS "admins manage courses" ON public.sunday_school_courses;
CREATE POLICY "admins read all courses"
  ON public.sunday_school_courses
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "admins manage courses"
  ON public.sunday_school_courses
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));