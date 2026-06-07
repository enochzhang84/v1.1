ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

DROP POLICY IF EXISTS "Allow public insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can register" ON public.registrations;
DROP POLICY IF EXISTS "anyone can register" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated read registrations" ON public.registrations;
DROP POLICY IF EXISTS "Admins read registrations" ON public.registrations;
DROP POLICY IF EXISTS "admins read registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated update registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow authenticated delete registrations" ON public.registrations;

CREATE POLICY "Allow public insert registrations"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated read registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert registrations"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update registrations"
ON public.registrations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete registrations"
ON public.registrations
FOR DELETE
TO authenticated
USING (true);