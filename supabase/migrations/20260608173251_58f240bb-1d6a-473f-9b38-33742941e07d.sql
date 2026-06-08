-- 1) registrations：删除过宽的策略，依赖按角色策略
DROP POLICY IF EXISTS "Allow authenticated read registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated update registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated delete registrations" ON public.registrations;

-- 2) kids_class_enrollment_snapshots：删除任意读策略，新增按角色读取
DROP POLICY IF EXISTS "anyone read kids snapshots" ON public.kids_class_enrollment_snapshots;

CREATE POLICY "admins and ss workers read kids snapshots"
  ON public.kids_class_enrollment_snapshots FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_above(auth.uid())
    OR public.worker_in_area(auth.uid(), 'sunday_school')
  );

-- 3) feedback-images 存储桶：替换无限制的匿名上传策略
DROP POLICY IF EXISTS "anyone upload feedback images" ON storage.objects;

CREATE POLICY "constrained upload feedback images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND (storage.foldername(name))[1] = 'feedback'
    AND lower(coalesce(storage.extension(name), '')) IN ('jpg','jpeg','png','webp','gif')
  );