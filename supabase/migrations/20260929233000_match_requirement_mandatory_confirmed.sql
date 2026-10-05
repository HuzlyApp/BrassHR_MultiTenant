-- Listing Fit uses confirmed mandatory rows only. Preferred confirmations
-- must not inflate the Strong share. CREATE OR REPLACE cannot change OUT columns.

DROP FUNCTION IF EXISTS public.job_application_requirement_counts(uuid, uuid[]);

CREATE FUNCTION public.job_application_requirement_counts(
  p_tenant_id uuid,
  p_application_ids uuid[]
)
RETURNS TABLE (
  job_application_id uuid,
  confirmed integer,
  verify integer,
  not_met integer,
  mandatory integer,
  blocking integer,
  mandatory_confirmed integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.job_application_id,
    count(*) FILTER (WHERE bucket = 'confirmed')::integer AS confirmed,
    count(*) FILTER (WHERE bucket = 'verify')::integer AS verify,
    count(*) FILTER (WHERE bucket = 'not_met')::integer AS not_met,
    count(*) FILTER (WHERE upper(coalesce(r.requirement_type, '')) = 'MANDATORY')::integer AS mandatory,
    count(*) FILTER (WHERE bucket = 'blocking')::integer AS blocking,
    count(*) FILTER (
      WHERE bucket = 'confirmed'
        AND upper(coalesce(r.requirement_type, '')) = 'MANDATORY'
    )::integer AS mandatory_confirmed
  FROM public.job_application_match_requirements r
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_APPLICABLE' THEN 'skip'
      WHEN r.recruiter_verified THEN 'confirmed'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'CONFLICT'
        OR upper(coalesce(r.status, '')) = 'CONFLICTING' THEN 'blocking'
      WHEN coalesce(r.verification_required, false)
        OR upper(coalesce(r.requirement_outcome, '')) = 'VERIFY' THEN 'verify'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'NOT_MET' THEN 'not_met'
      WHEN upper(coalesce(r.requirement_outcome, '')) = 'MET'
        OR upper(coalesce(r.status, '')) = 'CONFIRMED' THEN 'confirmed'
      ELSE 'skip'
    END AS bucket
  ) classified
  WHERE r.tenant_id = p_tenant_id
    AND r.job_application_id = ANY (p_application_ids)
  GROUP BY r.job_application_id;
$$;

COMMENT ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) IS
  'One grouped Conf/Verify/Not Met aggregate for a tenant-scoped application id list. mandatory_confirmed excludes preferred rows. Unrecognized outcomes are not counted as Verify.';

REVOKE ALL ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_application_requirement_counts(uuid, uuid[]) TO service_role;
