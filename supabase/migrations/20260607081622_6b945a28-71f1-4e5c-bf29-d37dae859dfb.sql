ALTER TABLE public.home_page_settings
  ADD COLUMN IF NOT EXISTS home_qr_updated_at timestamptz;