-- Realtime + RLS for applicant portal messaging (staff <-> approved applicants).

CREATE OR REPLACE FUNCTION public.approved_applicant_owns_worker(p_worker_id uuid)
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
      AND lower(trim(coalesce(w.status, ''))) = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.approved_applicant_owns_worker(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approved_applicant_owns_worker(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS applicant_messages_select_staff ON public.applicant_messages;
CREATE POLICY applicant_messages_select_staff
  ON public.applicant_messages
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS applicant_messages_select_applicant ON public.applicant_messages;
CREATE POLICY applicant_messages_select_applicant
  ON public.applicant_messages
  FOR SELECT
  TO authenticated
  USING (public.approved_applicant_owns_worker(worker_id));

DROP POLICY IF EXISTS applicant_messages_insert_staff ON public.applicant_messages;
CREATE POLICY applicant_messages_insert_staff
  ON public.applicant_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND sender_role = 'recruiter'
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.worker w
      WHERE w.id = worker_id
        AND w.tenant_id = tenant_id
    )
  );

DROP POLICY IF EXISTS applicant_messages_insert_applicant ON public.applicant_messages;
CREATE POLICY applicant_messages_insert_applicant
  ON public.applicant_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.approved_applicant_owns_worker(worker_id)
    AND tenant_id = (
      SELECT w.tenant_id
      FROM public.worker w
      WHERE w.id = worker_id
    )
    AND sender_role = 'applicant'
    AND sender_user_id = auth.uid()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.applicant_messages;
