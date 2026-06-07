
ALTER TABLE public.home_page_settings
  ADD COLUMN IF NOT EXISTS site_title text,
  ADD COLUMN IF NOT EXISTS site_subtitle text,
  ADD COLUMN IF NOT EXISTS bible_verse text,
  ADD COLUMN IF NOT EXISTS theme_text text,
  ADD COLUMN IF NOT EXISTS church_name text,
  ADD COLUMN IF NOT EXISTS church_address text,
  ADD COLUMN IF NOT EXISTS church_address_en text,
  ADD COLUMN IF NOT EXISTS church_phone text,
  ADD COLUMN IF NOT EXISTS church_email text,
  ADD COLUMN IF NOT EXISTS church_website text,
  ADD COLUMN IF NOT EXISTS worship_schedule text,
  ADD COLUMN IF NOT EXISTS primary_button_text text,
  ADD COLUMN IF NOT EXISTS primary_button_url text,
  ADD COLUMN IF NOT EXISTS secondary_button_text text,
  ADD COLUMN IF NOT EXISTS secondary_button_url text,
  ADD COLUMN IF NOT EXISTS background_image_url text,
  ADD COLUMN IF NOT EXISTS footer_text text;
