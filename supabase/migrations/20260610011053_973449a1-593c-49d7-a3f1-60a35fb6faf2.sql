
CREATE OR REPLACE FUNCTION public.get_email_queue_service_role_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_email_queue_service_role_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_queue_service_role_key() TO service_role;
