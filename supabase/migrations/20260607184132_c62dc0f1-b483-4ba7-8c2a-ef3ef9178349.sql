
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS visitor_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS relationship_to_primary text,
  ADD COLUMN IF NOT EXISTS primary_registration_id uuid,
  ADD COLUMN IF NOT EXISTS wechat text;

-- Backfill: each old row becomes its own group, marked as primary
UPDATE public.registrations
   SET visitor_group_id = gen_random_uuid()
 WHERE visitor_group_id IS NULL;

CREATE INDEX IF NOT EXISTS registrations_visitor_group_id_idx
  ON public.registrations(visitor_group_id);
CREATE INDEX IF NOT EXISTS registrations_primary_registration_id_idx
  ON public.registrations(primary_registration_id);
