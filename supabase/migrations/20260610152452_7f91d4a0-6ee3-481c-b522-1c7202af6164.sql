DROP INDEX IF EXISTS public.uq_group_join_records_source_group;

ALTER TABLE public.group_join_records
  ADD CONSTRAINT uq_group_join_records_source_group
  UNIQUE (source_registration_id, group_type);