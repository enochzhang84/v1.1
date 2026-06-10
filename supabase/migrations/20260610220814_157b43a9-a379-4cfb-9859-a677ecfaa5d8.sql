
-- 1. registrations 增加 is_test 字段
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_registrations_is_test ON public.registrations(is_test);

-- 2. qr_test_logs 表
CREATE TABLE IF NOT EXISTS public.qr_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_name text NOT NULL,
  qr_url text NOT NULL,
  final_url text,
  status text NOT NULL CHECK (status IN ('ok','warn','fail')),
  http_status integer,
  error_message text,
  entered_form_page boolean NOT NULL DEFAULT false,
  submitted_successfully boolean NOT NULL DEFAULT false,
  database_inserted boolean NOT NULL DEFAULT false,
  test_record_id uuid,
  cleaned_up boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT ON public.qr_test_logs TO authenticated;
GRANT ALL ON public.qr_test_logs TO service_role;

ALTER TABLE public.qr_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read qr_test_logs"
  ON public.qr_test_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins insert qr_test_logs"
  ON public.qr_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_qr_test_logs_created_at ON public.qr_test_logs(created_at DESC);
