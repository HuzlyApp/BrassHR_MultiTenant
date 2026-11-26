ALTER TABLE public.worker_license_records
 ADD COLUMN IF NOT EXISTS license_number_encrypted text,
 ADD COLUMN IF NOT EXISTS license_number_last_four text;
COMMENT ON COLUMN public.worker_license_records.license_number_encrypted IS 'Server-only AES-256-GCM envelope; key remains outside PostgreSQL.';
COMMENT ON COLUMN public.worker_license_records.license_number_last_four IS 'Display-only suffix; never the full identifier.';
-- Existing plaintext remains readable only by the server until an audited backfill.
REVOKE SELECT ON public.worker_license_records FROM PUBLIC, anon, authenticated;
REVOKE SELECT (license_number, license_number_encrypted) ON public.worker_license_records FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,worker_id,tenant_id,license_type,certification_name,expires_at,file_url,storage_path,original_file_name,file_type,file_size,status,review_notes,reviewed_at,reviewed_by,uploaded_at,created_at,updated_at,license_number_last_four)
 ON public.worker_license_records TO authenticated;
CREATE OR REPLACE FUNCTION public.reject_plaintext_license_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
 IF NEW.license_number IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.license_number IS DISTINCT FROM OLD.license_number) THEN
  RAISE EXCEPTION 'Full license identifiers require server-side encryption' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.reject_plaintext_license_number() FROM PUBLIC;
CREATE TRIGGER worker_license_number_encryption_required
 BEFORE INSERT OR UPDATE OF license_number ON public.worker_license_records
 FOR EACH ROW EXECUTE FUNCTION public.reject_plaintext_license_number();
