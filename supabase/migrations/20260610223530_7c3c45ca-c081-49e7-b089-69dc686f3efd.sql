UPDATE public.home_page_settings
SET qr_newcomer_url = 'https://qr-newbie-flow.lovable.app/register'
WHERE qr_newcomer_url ILIKE '%lovableproject.com%'
   OR qr_newcomer_url ILIKE '%id-preview%'
   OR qr_newcomer_url ILIKE '%localhost%';

UPDATE public.home_page_settings
SET qr_retreat_url = 'https://qr-newbie-flow.lovable.app/retreat-register'
WHERE qr_retreat_url ILIKE '%lovableproject.com%'
   OR qr_retreat_url ILIKE '%id-preview%'
   OR qr_retreat_url ILIKE '%hoc3.lioneapps.com%'
   OR qr_retreat_url ILIKE '%localhost%';