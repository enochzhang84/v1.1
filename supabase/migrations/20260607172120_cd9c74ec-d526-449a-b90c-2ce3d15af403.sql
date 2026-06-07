CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  released_at timestamptz,
  notes text,
  installed_at timestamptz NOT NULL DEFAULT now(),
  installed_by uuid,
  status text NOT NULL DEFAULT 'success',
  is_current boolean NOT NULL DEFAULT false,
  package_name text,
  error_log text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_versions TO authenticated;
GRANT ALL ON public.app_versions TO service_role;

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read versions" ON public.app_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin can insert versions" ON public.app_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update versions" ON public.app_versions
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE UNIQUE INDEX app_versions_one_current ON public.app_versions ((is_current)) WHERE is_current = true;

-- Seed initial version row
INSERT INTO public.app_versions (version, released_at, notes, is_current, status)
VALUES ('v1.0.0', '2026-06-07', '初始版本', true, 'success');