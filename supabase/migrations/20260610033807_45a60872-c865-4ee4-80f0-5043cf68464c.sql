
-- 团契与小组自动化牧养漏斗 migration

-- 1. group_join_records 新增字段
ALTER TABLE public.group_join_records
  ADD COLUMN IF NOT EXISTS follow_up_status text NOT NULL DEFAULT '待邀请',
  ADD COLUMN IF NOT EXISTS status_note text,
  ADD COLUMN IF NOT EXISTS attended_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attended_at date,
  ADD COLUMN IF NOT EXISTS source_registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_out boolean NOT NULL DEFAULT false;

-- 唯一索引：同一登记 + 同一组别只自动建一次
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_join_records_source_group
  ON public.group_join_records(source_registration_id, group_type)
  WHERE source_registration_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_join_records_follow_up_status
  ON public.group_join_records(follow_up_status);

-- 2. 自动建立幸福小组记录 + 转项处理
CREATE OR REPLACE FUNCTION public.registrations_autoflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_seeker boolean;
BEGIN
  -- 慕道友判定：faith='seeker' 或 faith_stage='慕道友'
  v_is_seeker := (COALESCE(NEW.faith, '') = 'seeker') OR (COALESCE(NEW.faith_stage, '') = '慕道友');

  IF TG_OP = 'INSERT' THEN
    IF v_is_seeker THEN
      INSERT INTO public.group_join_records (
        group_type, record_date, name, gender, faith_status,
        follow_up_status, source_registration_id, notes
      ) VALUES (
        'happiness_group', CURRENT_DATE, NEW.name, NEW.gender,
        COALESCE(NEW.faith_stage, '慕道友'),
        '待邀请', NEW.id, '由新人登记自动创建'
      )
      ON CONFLICT (source_registration_id, group_type) DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: 处理 transfer_target 变化
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.transfer_target,'') <> COALESCE(OLD.transfer_target,'') THEN
    -- 标记该 registration 之前所有 group_join_records 为已转出
    UPDATE public.group_join_records
       SET transferred_out = true,
           follow_up_status = CASE WHEN follow_up_status IN ('已参加','已转出') THEN follow_up_status ELSE '已转出' END
     WHERE source_registration_id = NEW.id
       AND group_type <> COALESCE(NEW.transfer_target, '');

    IF NEW.transfer_target IN ('happiness_group','grace_tea_group') THEN
      INSERT INTO public.group_join_records (
        group_type, record_date, name, gender, faith_status,
        follow_up_status, source_registration_id, notes
      ) VALUES (
        NEW.transfer_target, CURRENT_DATE, NEW.name, NEW.gender,
        COALESCE(NEW.faith_stage, ''),
        '待邀请', NEW.id, '由新人登记转项自动创建'
      )
      ON CONFLICT (source_registration_id, group_type) DO NOTHING;
    ELSIF NEW.transfer_target = 'decision_record' THEN
      INSERT INTO public.decisions (decision_date, name, gender, phone, email, notes, follow_up_status)
      SELECT CURRENT_DATE, NEW.name, NEW.gender, NEW.phone, NEW.email,
             '由新人登记转项自动创建', 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.decisions d
        WHERE d.name = NEW.name AND COALESCE(d.phone,'') = COALESCE(NEW.phone,'')
      );
    END IF;
    -- baptism_class 暂不自动建表记录（受洗信息字段需人工补全）
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrations_autoflow_ins ON public.registrations;
CREATE TRIGGER trg_registrations_autoflow_ins
  AFTER INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.registrations_autoflow();

DROP TRIGGER IF EXISTS trg_registrations_autoflow_upd ON public.registrations;
CREATE TRIGGER trg_registrations_autoflow_upd
  AFTER UPDATE OF transfer_target ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.registrations_autoflow();

-- 3. group_join_records 状态变 '已参加' 时自动累加参加次数
CREATE OR REPLACE FUNCTION public.group_join_records_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.follow_up_status = '已参加'
     AND COALESCE(OLD.follow_up_status,'') <> '已参加' THEN
    NEW.attended_count := COALESCE(OLD.attended_count, 0) + 1;
    NEW.last_attended_at := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_join_records_attendance ON public.group_join_records;
CREATE TRIGGER trg_group_join_records_attendance
  BEFORE UPDATE ON public.group_join_records
  FOR EACH ROW EXECUTE FUNCTION public.group_join_records_attendance();
