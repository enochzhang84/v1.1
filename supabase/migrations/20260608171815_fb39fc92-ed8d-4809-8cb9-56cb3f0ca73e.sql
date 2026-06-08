CREATE TABLE IF NOT EXISTS public.home_page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE DEFAULT 'home',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_content text,
  css_content text,
  is_published boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_page_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_page_content TO authenticated;
GRANT ALL ON public.home_page_content TO service_role;

ALTER TABLE public.home_page_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published home content"
  ON public.home_page_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert home content"
  ON public.home_page_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update home content"
  ON public.home_page_content FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete home content"
  ON public.home_page_content FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_home_page_content_updated_at
  BEFORE UPDATE ON public.home_page_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();