ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS database_version text;
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS release_description text;

INSERT INTO public.app_settings (key, value) VALUES ('system_version', 'v1.0.0')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('database_version', 'v1.0.0')
  ON CONFLICT (key) DO NOTHING;