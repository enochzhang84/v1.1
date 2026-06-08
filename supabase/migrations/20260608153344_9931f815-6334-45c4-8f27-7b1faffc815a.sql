-- registrations
DROP POLICY IF EXISTS "admins insert registrations" ON public.registrations;
CREATE POLICY "admins insert registrations" ON public.registrations
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins update registrations" ON public.registrations;
CREATE POLICY "admins update registrations" ON public.registrations
  FOR UPDATE TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins delete registrations" ON public.registrations;
CREATE POLICY "admins delete registrations" ON public.registrations
  FOR DELETE TO authenticated USING (public.is_admin_or_above(auth.uid()));

-- messages
DROP POLICY IF EXISTS "admins insert messages" ON public.messages;
CREATE POLICY "admins insert messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins update messages" ON public.messages;
CREATE POLICY "admins update messages" ON public.messages
  FOR UPDATE TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins delete messages" ON public.messages;
CREATE POLICY "admins delete messages" ON public.messages
  FOR DELETE TO authenticated USING (public.is_admin_or_above(auth.uid()));

-- attendance_records
DROP POLICY IF EXISTS "admins insert attendance" ON public.attendance_records;
CREATE POLICY "admins insert attendance" ON public.attendance_records
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins update attendance" ON public.attendance_records;
CREATE POLICY "admins update attendance" ON public.attendance_records
  FOR UPDATE TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins delete attendance" ON public.attendance_records;
CREATE POLICY "admins delete attendance" ON public.attendance_records
  FOR DELETE TO authenticated USING (public.is_admin_or_above(auth.uid()));
DROP POLICY IF EXISTS "admins read attendance" ON public.attendance_records;
CREATE POLICY "admins read attendance" ON public.attendance_records
  FOR SELECT TO authenticated USING (public.is_admin_or_above(auth.uid()));

-- meal_plans
DROP POLICY IF EXISTS "admins manage meal_plans" ON public.meal_plans;
CREATE POLICY "admins manage meal_plans" ON public.meal_plans
  FOR ALL TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- meal_types
DROP POLICY IF EXISTS "admins manage meal_types" ON public.meal_types;
CREATE POLICY "admins manage meal_types" ON public.meal_types
  FOR ALL TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- sunday_school_teachers
DROP POLICY IF EXISTS "admins manage teachers" ON public.sunday_school_teachers;
CREATE POLICY "admins manage teachers" ON public.sunday_school_teachers
  FOR ALL TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- duty_personnel
DROP POLICY IF EXISTS "admins manage duty_personnel" ON public.duty_personnel;
CREATE POLICY "admins manage duty_personnel" ON public.duty_personnel
  FOR ALL TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));

-- duty_schedules
DROP POLICY IF EXISTS "admins manage duty_schedules" ON public.duty_schedules;
CREATE POLICY "admins manage duty_schedules" ON public.duty_schedules
  FOR ALL TO authenticated USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));