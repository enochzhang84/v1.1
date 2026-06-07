ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

DROP POLICY IF EXISTS "Allow public insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "anyone can register" ON public.registrations;

CREATE POLICY "Allow public insert registrations"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read registrations" ON public.registrations;
DROP POLICY IF EXISTS "admins read registrations" ON public.registrations;

CREATE POLICY "Allow authenticated read registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (true);