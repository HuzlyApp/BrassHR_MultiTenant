-- Portal RBAC: a candidate JWT cannot read or write worker operations,
-- and a worker JWT cannot read or write candidate applications.
-- Staff and god admins keep their existing tenant access. service_role bypasses RLS.

CREATE OR REPLACE FUNCTION public.current_portal_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH memberships AS (
    SELECT ur.role
    FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id AND u.is_active
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.is_active
      AND ur.role IN ('candidate', 'worker')
  )
  SELECT CASE
    WHEN (SELECT count(*) FROM memberships) > 0 THEN (
      SELECT CASE WHEN count(DISTINCT role) = 1 THEN min(role) ELSE NULL END
      FROM memberships
    )
    ELSE (
      SELECT u.role
      FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.is_active
        AND u.role IN ('candidate', 'worker')
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.portal_access_allows(p_role text, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND (
      public.current_portal_role() = p_role
      OR public.is_god_admin_user()
      OR (
        p_tenant_id IS NOT NULL
        AND (
          public.user_is_tenant_staff(p_tenant_id)
          OR public.user_is_tenant_admin(p_tenant_id)
        )
      )
    );
$$;

COMMENT ON FUNCTION public.current_portal_role() IS
  'Active candidate or worker membership for auth.uid(). Mixed portal roles fail closed. Staff roles are not portal roles.';

COMMENT ON FUNCTION public.portal_access_allows(text, uuid) IS
  'True when the caller is the requested portal role, or staff/god admin for that tenant.';

REVOKE ALL ON FUNCTION public.current_portal_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.portal_access_allows(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_portal_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.portal_access_allows(text, uuid) TO authenticated, service_role;

DO $$
DECLARE
  worker_tables text[] := ARRAY[
    'groups',
    'group_messages',
    'worker_credentials',
    'worker_extra_files',
    'worker_profession_document_uploads',
    'worker_submitted_documents',
    'support_tickets',
    'support_ticket_messages',
    'support_ticket_attachments',
    'faqs',
    'employee_schedule_shifts',
    'employee_timesheet_entries',
    'worker_time_off',
    'applicant_appointments',
    'applicant_attendance_logs',
    'worker_requests',
    'timesheets'
  ];
  candidate_tables text[] := ARRAY[
    'job_applications',
    'worker_resumes',
    'applicant_profiles',
    'application_screening_answers',
    'applicant_skill_assessment_answers',
    'applicant_workflow_step_records',
    'worker_notes',
    'worker_pipeline_checklist_items',
    'worker_references'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY worker_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS portal_isolate_worker ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY portal_isolate_worker ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.portal_access_allows(''worker'', tenant_id))) WITH CHECK ((SELECT public.portal_access_allows(''worker'', tenant_id)))',
      t
    );
  END LOOP;

  FOREACH t IN ARRAY candidate_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS portal_isolate_candidate ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY portal_isolate_candidate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.portal_access_allows(''candidate'', tenant_id))) WITH CHECK ((SELECT public.portal_access_allows(''candidate'', tenant_id)))',
      t
    );
  END LOOP;
END $$;
