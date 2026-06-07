
-- Restrict anonymous read access on sensitive tables
DROP POLICY IF EXISTS "anyone read event_meal_notes" ON public.event_meal_notes;
CREATE POLICY "authenticated read event_meal_notes" ON public.event_meal_notes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "anyone read kids promotion records" ON public.kids_promotion_records;
CREATE POLICY "authenticated read kids promotion records" ON public.kids_promotion_records
  FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.event_meal_notes FROM anon;
REVOKE SELECT ON public.kids_promotion_records FROM anon;
