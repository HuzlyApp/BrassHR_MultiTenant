-- Resume import search was `extracted_text ILIKE`, which cannot use
-- worker_resumes_extracted_text_trgm_idx (that index is on
-- COALESCE(extracted_text, '')). NULL text matches neither form, so the
-- COALESCE predicate returns the same rows and can use the existing index.
-- Full-text search drops infix matches such as "urse" inside "nurse".
--
-- Do not SET search_path on this function. That blocks SQL inlining, and the
-- non-inlined body plans as a sequential scan (about 1.8s for a rare term).
-- Inlined, the same predicate uses the trigram index (about 3ms). Every
-- name below is schema-qualified.

CREATE OR REPLACE FUNCTION public.match_resume_worker_ids(
  p_tenant_id uuid,
  p_pattern text,
  p_limit integer DEFAULT 250
)
RETURNS TABLE (worker_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT wr.worker_id
  FROM public.worker_resumes wr
  WHERE wr.tenant_id = p_tenant_id
    AND wr.deleted_at IS NULL
    AND wr.worker_id IS NOT NULL
    AND p_pattern IS NOT NULL
    AND btrim(p_pattern) <> ''
    AND coalesce(wr.extracted_text, '') ILIKE p_pattern
  LIMIT least(greatest(coalesce(p_limit, 250), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_resume_worker_ids(uuid, text, integer) TO service_role;
