-- Import search calls this through PostgREST. A LANGUAGE sql body is inlined, and
-- the pattern arrives as a json_to_record column, so the planner cannot see a
-- constant ILIKE pattern. It then scans every resume for the tenant
-- (worker_resumes_tenant_parse_status_idx + filter) and hits statement_timeout.
-- A direct call with a literal pattern uses worker_resumes_extracted_text_trgm_idx.
--
-- Plan a fresh statement where the pattern is a quoted literal so that GIN
-- trigram index stays eligible. Keep the function SECURITY INVOKER and
-- service_role-only; dynamic SQL is built with format %L / a clamped integer.

CREATE OR REPLACE FUNCTION public.match_resume_worker_ids(
  p_tenant_id uuid,
  p_pattern text,
  p_limit integer DEFAULT 250
)
RETURNS TABLE (worker_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  lim integer;
BEGIN
  IF p_tenant_id IS NULL OR p_pattern IS NULL OR btrim(p_pattern) = '' THEN
    RETURN;
  END IF;

  lim := least(greatest(coalesce(p_limit, 250), 1), 500);

  RETURN QUERY EXECUTE format(
    $sql$
    SELECT wr.worker_id
    FROM public.worker_resumes wr
    WHERE wr.tenant_id = %L::uuid
      AND wr.deleted_at IS NULL
      AND wr.worker_id IS NOT NULL
      AND coalesce(wr.extracted_text, '') ILIKE %L
    LIMIT %s
    $sql$,
    p_tenant_id,
    p_pattern,
    lim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) TO service_role;
