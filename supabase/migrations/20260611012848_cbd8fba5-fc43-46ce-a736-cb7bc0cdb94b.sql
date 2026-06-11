CREATE TABLE public.qr_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  route_path text NOT NULL,
  module text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_path)
);

GRANT SELECT ON public.qr_registry TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qr_registry TO authenticated;
GRANT ALL ON public.qr_registry TO service_role;

ALTER TABLE public.qr_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_registry public read" ON public.qr_registry
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "qr_registry admin write" ON public.qr_registry
  FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_qr_registry_updated
  BEFORE UPDATE ON public.qr_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.qr_registry (name, route_path, module, is_system, sort_order) VALUES
  ('新人登记', '/register', 'newcomer', true, 10),
  ('退修会登记', '/retreat-register', 'retreat', true, 20),
  ('主日签到', '/sunday-checkin', 'sunday', true, 30),
  ('团契 / 小组签到', '/fellowship-checkin', 'fellowship', true, 40),
  ('成人主日学（春季）', '/adult-checkin/summer', 'sunday', true, 50),
  ('成人主日学（秋季）', '/adult-checkin/fall', 'sunday', true, 60),
  ('服务申请', '/serve-apply', 'ministry', true, 70),
  ('问题反馈', '/feedback', 'feedback', true, 80)
ON CONFLICT (route_path) DO NOTHING;