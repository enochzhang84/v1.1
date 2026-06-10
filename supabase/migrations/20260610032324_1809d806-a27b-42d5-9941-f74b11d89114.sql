-- 1) 团契与小组：加入名单表（幸福小组 / 恩典茶经小组共用）
CREATE TABLE public.group_join_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_type text NOT NULL CHECK (group_type IN ('happiness_group','grace_tea_group')),
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL,
  gender text,
  faith_status text,
  joined_at date,
  status text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_join_records TO authenticated;
GRANT ALL ON public.group_join_records TO service_role;

ALTER TABLE public.group_join_records ENABLE ROW LEVEL SECURITY;

-- 管理员 / super 全权
CREATE POLICY "group_join_records admins all"
  ON public.group_join_records
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- 团契与小组事工同工可读写
CREATE POLICY "group_join_records fellowship workers"
  ON public.group_join_records
  FOR ALL
  TO authenticated
  USING (public.worker_in_area(auth.uid(), 'fellowship'))
  WITH CHECK (public.worker_in_area(auth.uid(), 'fellowship'));

CREATE INDEX idx_group_join_records_group_date
  ON public.group_join_records (group_type, record_date DESC);

CREATE TRIGGER trg_group_join_records_updated_at
  BEFORE UPDATE ON public.group_join_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) 新人登记表新增 "转项" 字段
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS transfer_target text;

COMMENT ON COLUMN public.registrations.transfer_target IS
  '新人后续跟进去向：happiness_group / grace_tea_group / baptism_class / decision_record';
