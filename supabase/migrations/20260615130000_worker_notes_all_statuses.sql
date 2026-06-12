-- Allow workers/candidates in any status (pending, rejected, approved, etc.) to read recruiter notes.

CREATE OR REPLACE FUNCTION public.worker_owns_record(p_worker_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worker w
    WHERE w.id = p_worker_id
      AND w.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.worker_owns_record(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.worker_owns_record(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS worker_notes_worker_read ON public.worker_notes;
CREATE POLICY worker_notes_worker_read
  ON public.worker_notes FOR SELECT TO authenticated
  USING (public.worker_owns_record(worker_id));
