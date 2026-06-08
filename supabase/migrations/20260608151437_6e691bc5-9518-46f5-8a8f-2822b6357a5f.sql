-- Tighten anonymous Data API grants for QR public pages while preserving public submissions.

REVOKE SELECT, UPDATE, DELETE ON public.registrations FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.retreat_registrations FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.fellowship_checkins FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.adult_class_checkins FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.service_applications FROM anon;
REVOKE SELECT, UPDATE, DELETE ON public.feedbacks FROM anon;

GRANT INSERT ON public.registrations TO anon;
GRANT INSERT ON public.retreat_registrations TO anon;
GRANT INSERT ON public.fellowship_checkins TO anon;
GRANT INSERT ON public.adult_class_checkins TO anon;
GRANT INSERT ON public.service_applications TO anon;
GRANT INSERT ON public.feedbacks TO anon;

-- Public pages only need to read minimal option/configuration columns.
REVOKE INSERT, UPDATE, DELETE ON public.events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.fellowships FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.home_page_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.service_projects FROM anon;
REVOKE SELECT ON public.fellowships FROM anon;
REVOKE SELECT ON public.home_page_settings FROM anon;
REVOKE SELECT ON public.events FROM anon;
REVOKE SELECT ON public.service_projects FROM anon;
GRANT SELECT (id, name, qr_token, is_active) ON public.events TO anon;
GRANT SELECT (id, name, sort_order, is_active) ON public.fellowships TO anon;
GRANT SELECT (qr_newcomer_url, qr_retreat_url, qr_image_url, updated_at) ON public.home_page_settings TO anon;
GRANT SELECT (id, name, sort_order, is_active) ON public.service_projects TO anon;