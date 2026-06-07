-- Restore missing role GRANTs on public-facing tables so anonymous scan
-- pages (registration, retreat, adult class check-in, fellowship check-in)
-- can submit data. RLS policies already permit anon INSERT; the Data API
-- additionally requires table-level GRANTs which were lost.

-- Anonymous scan / submit tables: anon INSERT, authenticated full access via RLS
GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

GRANT INSERT ON public.retreat_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retreat_registrations TO authenticated;
GRANT ALL ON public.retreat_registrations TO service_role;

GRANT INSERT ON public.adult_class_checkins TO anon;
GRANT SELECT, INSERT ON public.adult_class_checkins TO authenticated;
GRANT ALL ON public.adult_class_checkins TO service_role;

GRANT INSERT ON public.fellowship_checkins TO anon;
GRANT SELECT, INSERT ON public.fellowship_checkins TO authenticated;
GRANT ALL ON public.fellowship_checkins TO service_role;

-- Reference tables the scan pages READ from anonymously
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

GRANT SELECT ON public.home_page_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_page_settings TO authenticated;
GRANT ALL ON public.home_page_settings TO service_role;

GRANT SELECT ON public.fellowships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fellowships TO authenticated;
GRANT ALL ON public.fellowships TO service_role;

-- Feedback / contact submission (also QR-driven)
GRANT INSERT ON public.feedbacks TO anon;
GRANT SELECT, INSERT, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;