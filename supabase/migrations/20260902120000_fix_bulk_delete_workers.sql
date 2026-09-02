-- Fix bulk_delete_workers: wrong table name (worker_shift_requirements) and
-- skill_assessments has no tenant_id column.

CREATE OR REPLACE FUNCTION public.bulk_delete_workers(
  p_tenant_id uuid,
  p_worker_ids uuid[]
)
RETURNS TABLE (deleted_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  SELECT ARRAY(
    SELECT w.id
    FROM public.worker w
    WHERE w.tenant_id = p_tenant_id
      AND w.id IN (
        SELECT DISTINCT id
        FROM unnest(COALESCE(p_worker_ids, ARRAY[]::uuid[])) AS id
        WHERE id IS NOT NULL
      )
  )
  INTO v_ids;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  PERFORM w.id
  FROM public.worker w
  WHERE w.id = ANY (v_ids)
  FOR UPDATE;

  DELETE FROM public.job_applications
  WHERE tenant_id = p_tenant_id
    AND worker_id = ANY (v_ids);

  DELETE FROM public.worker_requirements
  WHERE worker_id = ANY (v_ids);

  DELETE FROM public.skill_assessments
  WHERE worker_id = ANY (v_ids);

  DELETE FROM public.worker_references
  WHERE worker_id = ANY (v_ids);

  RETURN QUERY
  DELETE FROM public.worker w
  WHERE w.tenant_id = p_tenant_id
    AND w.id = ANY (v_ids)
  RETURNING w.id;
END;
$$;

COMMENT ON FUNCTION public.bulk_delete_workers(uuid, uuid[]) IS
  'Tenant-scoped atomic candidate delete. Applications and restrictive worker dependents are removed only if the worker delete succeeds.';

REVOKE ALL ON FUNCTION public.bulk_delete_workers(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_delete_workers(uuid, uuid[]) TO service_role;
