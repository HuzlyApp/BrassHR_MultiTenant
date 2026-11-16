-- Reconciled source: 20261027020000_tenant_categories.sql
DO $bundle$ BEGIN IF to_regclass('public.tenant_categories') IS NULL THEN EXECUTE $source$
-- One product category per tenant. Staffing is the default for every existing
-- tenant and for tenants created later. SMB is stored only when assigned explicitly.

CREATE TABLE IF NOT EXISTS public.tenant_categories (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Staffing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_categories_category_check CHECK (category IN ('Staffing', 'SMB'))
);

COMMENT ON TABLE public.tenant_categories IS
  'One product category per tenant. Staffing is the default; SMB is assigned explicitly.';
COMMENT ON COLUMN public.tenant_categories.category IS
  'Staffing or SMB. New and backfilled tenants use Staffing unless SMB is set explicitly.';

-- tenant_id is the primary key, so the foreign key is already indexed.
CREATE INDEX IF NOT EXISTS tenant_categories_category_idx
  ON public.tenant_categories (category);

CREATE OR REPLACE FUNCTION public.assign_default_tenant_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_categories (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_default_tenant_category() IS
  'Inserts the Staffing category for a new tenant. Does not change an existing category.';

REVOKE ALL ON FUNCTION public.assign_default_tenant_category() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_default_tenant_category() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_default_tenant_category() TO service_role;

CREATE TRIGGER trg_tenants_assign_default_category
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_tenant_category();

CREATE OR REPLACE FUNCTION public.tenant_categories_guard_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_categories.tenant_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_categories_guard_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tenant_categories_guard_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.tenant_categories_guard_tenant_id() TO authenticated, service_role;

CREATE TRIGGER trg_tenant_categories_guard_tenant_id
  BEFORE UPDATE ON public.tenant_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.tenant_categories_guard_tenant_id();

CREATE TRIGGER trg_tenant_categories_set_updated_at
  BEFORE UPDATE ON public.tenant_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tenant_categories (tenant_id)
SELECT t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_categories c
  WHERE c.tenant_id = t.id
);

ALTER TABLE public.tenant_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_categories_select_member
  ON public.tenant_categories
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
    OR public.user_is_tenant_staff(tenant_id)
  );

CREATE POLICY tenant_categories_insert_god_admin
  ON public.tenant_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_god_admin_user()));

CREATE POLICY tenant_categories_update_god_admin
  ON public.tenant_categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

-- Default privileges grant every Data API role full access to new public tables.
REVOKE ALL ON TABLE public.tenant_categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tenant_categories TO authenticated;
GRANT INSERT, UPDATE ON TABLE public.tenant_categories TO authenticated;
GRANT ALL ON TABLE public.tenant_categories TO service_role;

NOTIFY pgrst, 'reload schema';

$source$; END IF; END $bundle$;

-- Reconciled source: 20261028010000_role_module_permissions.sql
DO $bundle$ BEGIN IF to_regclass('public.permission_resources') IS NULL THEN EXECUTE $source$
-- Tenant-scoped sidebar and Settings permissions.
--
-- Legacy mapping (View/Create/Edit/Delete/Approve/Manage were never stored):
--   Create and Approve fold into Edit.
--   Manage folds into Edit on settings_company, granted to system admin only.
--   System admin (staff_roles.is_admin) receives view, edit, and delete on every
--   configurable resource so existing administrators keep full access.
--   Other seeded staff roles receive view, edit, and delete only on the modules
--   and Settings sections they could already open (hiring, people, organization,
--   jobs, scheduling, mail, chat, personal settings, notifications, help, reports).
--   They do not receive company settings, automation, or templates.
--   Dashboard is always_granted and has no permission rows.

CREATE TABLE IF NOT EXISTS public.permission_resources (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL,
  parent_key text,
  page_prefixes text[] NOT NULL DEFAULT '{}',
  api_prefixes text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  always_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permission_resources_key_format CHECK (key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT permission_resources_kind CHECK (kind IN ('module', 'settings_section')),
  CONSTRAINT permission_resources_label_not_blank CHECK (char_length(btrim(label)) > 0)
);

CREATE TABLE IF NOT EXISTS public.tenant_roles (
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_key),
  CONSTRAINT tenant_roles_key_format CHECK (role_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT tenant_roles_label_not_blank CHECK (char_length(btrim(label)) > 0)
);

CREATE INDEX IF NOT EXISTS tenant_roles_tenant_idx ON public.tenant_roles (tenant_id);

CREATE TRIGGER trg_tenant_roles_set_updated_at
  BEFORE UPDATE ON public.tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  tenant_id uuid NOT NULL,
  role_key text NOT NULL,
  resource_key text NOT NULL REFERENCES public.permission_resources (key) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, role_key, resource_key),
  CONSTRAINT tenant_role_permissions_role_fk
    FOREIGN KEY (tenant_id, role_key)
    REFERENCES public.tenant_roles (tenant_id, role_key)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tenant_role_permissions_lookup_idx
  ON public.tenant_role_permissions (tenant_id, role_key);

CREATE TRIGGER trg_tenant_role_permissions_set_updated_at
  BEFORE UPDATE ON public.tenant_role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permission_resources
  (key, label, description, kind, parent_key, page_prefixes, api_prefixes, sort_order, always_granted)
VALUES
  ('dashboard', 'Dashboard', 'View dashboard and summary.', 'module', NULL,
    ARRAY['/admin_recruiter/home', '/admin_recruiter/dashboard'],
    ARRAY['/api/admin/dashboard-overview', '/api/admin/dashboard-analytics'], 10, true),
  ('hiring', 'Hiring', 'View and manage applicants.', 'module', NULL,
    ARRAY['/admin_recruiter/candidates', '/admin_recruiter/applications', '/admin_recruiter/calendar', '/admin_recruiter/pending', '/admin_recruiter/approved', '/admin_recruiter/approved-pending-conversion', '/admin_recruiter/disapproved', '/admin_recruiter/pre-approval', '/admin_recruiter/advanced-search', '/admin_recruiter/advanced-detail', '/admin_recruiter/new'],
    ARRAY['/api/admin/job-applications', '/api/admin/candidates', '/api/admin/add-candidate-from-resume', '/api/admin/applicant-appointments', '/api/admin/application-statuses', '/api/admin/application-status-groups', '/api/admin/application-status-stage-assignments', '/api/admin/hiring-area', '/api/admin/stage-context-notes', '/api/admin/skill-assessment-pdf', '/api/admin/skill-assessment-results', '/api/admin/match-analysis'], 20, false),
  ('people', 'People', 'View and manage workers and managers.', 'module', NULL,
    ARRAY['/admin_recruiter/workers', '/admin_recruiter/managers'],
    ARRAY['/api/admin/workers', '/api/admin/employment-workers', '/api/admin/team-members', '/api/admin/worker-*'], 30, false),
  ('organization', 'Organization', 'Manage facilities and locations.', 'module', NULL,
    ARRAY['/admin_recruiter/facilities'],
    ARRAY['/api/admin/facilities', '/api/admin/facility-assignments'], 40, false),
  ('jobs', 'Jobs', 'Create and manage job orders.', 'module', NULL,
    ARRAY['/admin_recruiter/jobs'],
    ARRAY['/api/admin/jobs', '/api/admin/job-options', '/api/admin/professions'], 50, false),
  ('scheduling', 'Scheduling', 'Manage schedules and shifts.', 'module', NULL,
    ARRAY['/admin_recruiter/calendar/shifts', '/admin_recruiter/attendance', '/admin_recruiter/scheduling'],
    ARRAY['/api/admin/shift-calendar', '/api/admin/applicant-attendance'], 60, false),
  ('mail', 'Mail', 'View and manage mail.', 'module', NULL,
    ARRAY['/admin_recruiter/mail'],
    ARRAY['/api/admin/mail'], 70, false),
  ('chat', 'Chat', 'View and manage messages.', 'module', NULL,
    ARRAY['/admin_recruiter/messages'],
    ARRAY['/api/admin/messages'], 80, false),
  ('settings_company', 'Company settings', 'Manage organization settings, branding, and roles.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/settings'],
    ARRAY['/api/admin/users', '/api/admin/roles', '/api/admin/branding', '/api/admin/business-info', '/api/admin/assessment-settings', '/api/admin/hire-journey-theme', '/api/admin/profession-documents', '/api/admin/tenant-firma-settings', '/api/admin/tenants'], 110, false),
  ('settings_profile', 'Personal settings', 'View and edit the signed-in profile.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/account'],
    ARRAY['/api/account/settings'], 120, false),
  ('settings_notifications', 'Notifications', 'View notification settings.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/notifications'],
    ARRAY[]::text[], 130, false),
  ('settings_help', 'Help & Support', 'View help and support.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/help-support', '/admin_recruiter/support-tickets', '/admin_recruiter/tickets'],
    ARRAY['/api/admin/faqs'], 140, false),
  ('settings_reports', 'Reports', 'View reports and analytics.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/reports'],
    ARRAY[]::text[], 150, false),
  ('settings_automation', 'Automation', 'Manage workflows and onboarding automation.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/dashboard/onboarding-builder', '/admin_recruiter/dashboard/onboarding-flows', '/admin_recruiter/dashboard/templates', '/admin_recruiter/dashboard/workflow-mappings', '/admin_recruiter/dashboard/workflowlibrary'],
    ARRAY['/api/admin/onboarding', '/api/admin/onboarding-builder', '/api/admin/onboarding-flows', '/api/admin/onboarding-libraries', '/api/admin/workflow-mappings', '/api/admin/workflow-templates'], 160, false),
  ('settings_templates', 'Templates', 'Manage document and email templates.', 'settings_section', NULL,
    ARRAY['/admin_recruiter/template-builder', '/admin_recruiter/email-templates'],
    ARRAY['/api/admin/email-templates', '/api/admin/recruiter-templates'], 170, false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_tenant_role_access(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tenant_roles (tenant_id, role_key, label, description, is_system, is_admin)
  SELECT p_tenant_id, sr.key, sr.label, '', true, sr.is_admin
  FROM public.staff_roles sr
  WHERE sr.is_active
    AND sr.is_staff
  ON CONFLICT (tenant_id, role_key) DO NOTHING;

  INSERT INTO public.tenant_role_permissions (tenant_id, role_key, resource_key, can_view, can_edit, can_delete)
  SELECT tr.tenant_id, tr.role_key, pr.key, true, true, true
  FROM public.tenant_roles tr
  JOIN public.permission_resources pr ON pr.always_granted = false
  WHERE tr.tenant_id = p_tenant_id
    AND tr.is_system
    AND tr.is_admin
  ON CONFLICT (tenant_id, role_key, resource_key) DO NOTHING;

  INSERT INTO public.tenant_role_permissions (tenant_id, role_key, resource_key, can_view, can_edit, can_delete)
  SELECT tr.tenant_id, tr.role_key, pr.key, true, true, true
  FROM public.tenant_roles tr
  JOIN public.permission_resources pr
    ON pr.always_granted = false
   AND pr.key = ANY (ARRAY[
     'hiring',
     'people',
     'organization',
     'jobs',
     'scheduling',
     'mail',
     'chat',
     'settings_profile',
     'settings_notifications',
     'settings_help',
     'settings_reports'
   ]::text[])
  WHERE tr.tenant_id = p_tenant_id
    AND tr.is_system
    AND tr.is_admin = false
  ON CONFLICT (tenant_id, role_key, resource_key) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_tenant_role_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_tenant_role_access(uuid) TO service_role;

SELECT public.seed_tenant_role_access(id) FROM public.tenants;

CREATE OR REPLACE FUNCTION public.trg_tenants_seed_role_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.seed_tenant_role_access(NEW.id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_tenants_seed_role_access() FROM PUBLIC;

CREATE TRIGGER trg_tenants_seed_role_access
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tenants_seed_role_access();

ALTER TABLE public.permission_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY permission_resources_select_authenticated
  ON public.permission_resources
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY tenant_roles_select_tenant_staff
  ON public.tenant_roles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

CREATE POLICY tenant_role_permissions_select_tenant_staff
  ON public.tenant_role_permissions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

REVOKE ALL ON TABLE public.permission_resources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tenant_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tenant_role_permissions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.permission_resources TO authenticated;
GRANT SELECT ON TABLE public.tenant_roles TO authenticated;
GRANT SELECT ON TABLE public.tenant_role_permissions TO authenticated;

GRANT ALL ON TABLE public.permission_resources TO service_role;
GRANT ALL ON TABLE public.tenant_roles TO service_role;
GRANT ALL ON TABLE public.tenant_role_permissions TO service_role;

COMMENT ON TABLE public.permission_resources IS 'Sidebar modules and Settings sections. Dashboard is always_granted and is not a role-matrix row.';
COMMENT ON TABLE public.tenant_roles IS 'Per-tenant staff roles. System rows are copied from staff_roles; custom rows are created in Company settings.';
COMMENT ON TABLE public.tenant_role_permissions IS 'View, edit, and delete grants. Edit does not imply delete.';

$source$; END IF; END $bundle$;

-- Reconciled source: 20261030193000_departments.sql
DO $bundle$ BEGIN IF to_regclass('public.departments') IS NULL THEN EXECUTE $source$
-- Tenant department catalog.
-- A job stores department_id so every candidate on that job inherits it.
-- A candidate stores department_id when they are mapped directly.
-- The candidate's own department wins over the job's department.

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_name_not_empty CHECK (char_length(btrim(name)) > 0)
);

COMMENT ON TABLE public.departments IS
  'Organization departments. Jobs and candidates reference a row in this catalog.';

CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_name_uidx
  ON public.departments (tenant_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS departments_tenant_active_idx
  ON public.departments (tenant_id, is_active, name);

CREATE TRIGGER trg_departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_requisitions.department_id IS
  'Catalog department for this job. department text stays as the display label.';

CREATE INDEX IF NOT EXISTS job_requisitions_department_id_idx
  ON public.job_requisitions (department_id);

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.worker.department_id IS
  'Direct department for this candidate. When set, it overrides the job department.';

CREATE INDEX IF NOT EXISTS worker_department_id_idx
  ON public.worker (department_id);

CREATE OR REPLACE FUNCTION public.sync_job_requisition_department_label()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_tenant uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT btrim(name), tenant_id
  INTO v_name, v_tenant
  FROM public.departments
  WHERE id = NEW.department_id;

  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Department does not belong to this organization';
  END IF;

  NEW.department = v_name;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_job_requisition_department_label() IS
  'Copies the catalog department name onto the job and rejects a department from another tenant.';

REVOKE ALL ON FUNCTION public.sync_job_requisition_department_label() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_job_requisition_department_label() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_job_requisition_department_label() TO authenticated, service_role;

CREATE TRIGGER trg_job_requisitions_sync_department_label
  BEFORE INSERT OR UPDATE OF department_id ON public.job_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_requisition_department_label();

CREATE OR REPLACE FUNCTION public.assert_worker_department_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF NEW.department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id
  INTO v_tenant
  FROM public.departments
  WHERE id = NEW.department_id;

  IF v_tenant IS NULL OR v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Department does not belong to this organization';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_worker_department_tenant() IS
  'Rejects a candidate department that belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_worker_department_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_worker_department_tenant() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_worker_department_tenant() TO authenticated, service_role;

CREATE TRIGGER trg_worker_assert_department_tenant
  BEFORE INSERT OR UPDATE OF department_id ON public.worker
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_worker_department_tenant();

INSERT INTO public.departments (tenant_id, name)
SELECT DISTINCT ON (j.tenant_id, lower(btrim(j.department)))
  j.tenant_id,
  btrim(j.department)
FROM public.job_requisitions j
WHERE j.department IS NOT NULL
  AND char_length(btrim(j.department)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.departments d
    WHERE d.tenant_id = j.tenant_id
      AND lower(btrim(d.name)) = lower(btrim(j.department))
  )
ORDER BY j.tenant_id, lower(btrim(j.department)), btrim(j.department);

UPDATE public.job_requisitions j
SET department_id = d.id
FROM public.departments d
WHERE j.department_id IS NULL
  AND j.tenant_id = d.tenant_id
  AND j.department IS NOT NULL
  AND lower(btrim(j.department)) = lower(btrim(d.name));

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;

CREATE POLICY departments_staff_select
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

CREATE POLICY departments_admin_write
  ON public.departments
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_admin(tenant_id))
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_admin(tenant_id))
  );

REVOKE ALL ON TABLE public.departments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.departments TO authenticated;
GRANT ALL ON TABLE public.departments TO service_role;

UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/departments']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/departments' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );

NOTIFY pgrst, 'reload schema';

$source$; END IF; END $bundle$;

-- Reconciled source: 20261104173000_settings_help_always_granted.sql
-- Help & Support and Reports live in Settings for every authenticated staff role.
UPDATE public.permission_resources
SET always_granted = true
WHERE key IN ('settings_help', 'settings_reports');

-- Drop obsolete matrix rows; access is always_granted going forward.
DELETE FROM public.tenant_role_permissions
WHERE resource_key IN ('settings_help', 'settings_reports');


-- Reconciled source: 20261106120000_organization_clients_permission.sql
-- Clients UI/API belong to the Organization module (facilities + clients).
-- Without these prefixes, /api/admin/clients and /admin_recruiter/clients are
-- classified as unmapped and return 403 Insufficient permission.

UPDATE public.permission_resources
SET
  description = 'Manage facilities, clients, and locations.',
  page_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(page_prefixes, ARRAY[]::text[]) || ARRAY['/admin_recruiter/clients']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  ),
  api_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/clients']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  )
WHERE key = 'organization';


-- Reconciled source: 20261106121500_scheduling_timesheets_permission.sql
-- Timesheets (and related scheduling APIs) belong to the Scheduling module.
-- Without these prefixes, /admin_recruiter/timesheets is classified as unmapped
-- and returns "You don't have access to that page."

UPDATE public.permission_resources
SET
  description = 'Manage schedules, shifts, clock-ins, and timesheets.',
  page_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(page_prefixes, ARRAY[]::text[])
        || ARRAY['/admin_recruiter/timesheets']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  ),
  api_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(api_prefixes, ARRAY[]::text[])
        || ARRAY[
          '/api/admin/timesheets',
          '/api/admin/scheduling',
          '/api/admin/shifts'
        ]::text[]
      ) AS prefix
      ORDER BY prefix
    )
  )
WHERE key = 'scheduling';


-- Reconciled source: 20261107041000_employee_schedule_shifts.sql
DO $bundle$ BEGIN IF to_regclass('public.employee_schedule_shifts') IS NULL THEN EXECUTE $source$
-- Per-employee day shifts for the recruiter week view.
-- One row is one block on the schedule grid (employee x date).

CREATE TABLE IF NOT EXISTS public.employee_schedule_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facility (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  work_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  title text NOT NULL,
  rate_per_hour numeric(10, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_schedule_shifts_title_not_empty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT employee_schedule_shifts_times_differ CHECK (start_time <> end_time),
  CONSTRAINT employee_schedule_shifts_rate_nonnegative CHECK (rate_per_hour IS NULL OR rate_per_hour >= 0)
);

COMMENT ON TABLE public.employee_schedule_shifts IS
  'Assigned work blocks shown on the recruiter week schedule. Each row is one employee on one date.';

COMMENT ON COLUMN public.employee_schedule_shifts.worker_id IS
  'Hired employee (public.workers), not an applicant in public.worker.';

COMMENT ON COLUMN public.employee_schedule_shifts.start_time IS
  'Wall-clock start. Overnight shifts may have end_time earlier than start_time.';

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_tenant_date_idx
  ON public.employee_schedule_shifts (tenant_id, work_date);

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_worker_date_idx
  ON public.employee_schedule_shifts (worker_id, work_date);

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_facility_id_idx
  ON public.employee_schedule_shifts (facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_schedule_shifts_department_id_idx
  ON public.employee_schedule_shifts (department_id)
  WHERE department_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_employee_schedule_shift_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_worker_tenant uuid;
  v_facility_tenant uuid;
  v_department_tenant uuid;
BEGIN
  SELECT tenant_id
  INTO v_worker_tenant
  FROM public.workers
  WHERE id = NEW.worker_id;

  IF v_worker_tenant IS NULL OR v_worker_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Employee does not belong to this organization';
  END IF;

  IF NEW.facility_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_facility_tenant
    FROM public.facility
    WHERE id = NEW.facility_id;

    IF v_facility_tenant IS NULL OR v_facility_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Facility does not belong to this organization';
    END IF;
  END IF;

  IF NEW.department_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_department_tenant
    FROM public.departments
    WHERE id = NEW.department_id;

    IF v_department_tenant IS NULL OR v_department_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Department does not belong to this organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_employee_schedule_shift_scope() IS
  'Rejects a schedule shift whose employee, facility, or department belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_employee_schedule_shift_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_employee_schedule_shift_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_employee_schedule_shift_scope() TO authenticated, service_role;

CREATE TRIGGER trg_employee_schedule_shifts_assert_scope
  BEFORE INSERT OR UPDATE OF tenant_id, worker_id, facility_id, department_id
  ON public.employee_schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_employee_schedule_shift_scope();

CREATE TRIGGER trg_employee_schedule_shifts_set_updated_at
  BEFORE UPDATE ON public.employee_schedule_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_schedule_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_schedule_shifts FORCE ROW LEVEL SECURITY;

CREATE POLICY employee_schedule_shifts_staff_select
  ON public.employee_schedule_shifts
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

CREATE POLICY employee_schedule_shifts_staff_write
  ON public.employee_schedule_shifts
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

REVOKE ALL ON TABLE public.employee_schedule_shifts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_schedule_shifts TO authenticated;
GRANT ALL ON TABLE public.employee_schedule_shifts TO service_role;

NOTIFY pgrst, 'reload schema';

$source$; END IF; END $bundle$;

-- Reconciled source: 20261107043000_employee_timesheet_entries.sql
DO $bundle$ BEGIN IF to_regclass('public.employee_timesheet_entries') IS NULL THEN EXECUTE $source$
-- Daily timesheet rows for hired employees on the recruiter timesheets page.
-- One row is one employee on one work date.

CREATE TABLE IF NOT EXISTS public.employee_timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers (id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.facility (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  work_date date NOT NULL,
  regular_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  break_minutes integer NOT NULL DEFAULT 0,
  clock_in time,
  clock_out time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_timesheet_entries_worker_date_unique UNIQUE (worker_id, work_date),
  CONSTRAINT employee_timesheet_entries_minutes_bounds CHECK (
    regular_minutes >= 0
    AND regular_minutes <= 1440
    AND overtime_minutes >= 0
    AND overtime_minutes <= 1440
    AND break_minutes >= 0
    AND break_minutes <= 1440
  )
);

COMMENT ON TABLE public.employee_timesheet_entries IS
  'Daily worked time for a hired employee. The recruiter timesheets week view aggregates these rows.';

COMMENT ON COLUMN public.employee_timesheet_entries.worker_id IS
  'Hired employee (public.workers), not an applicant in public.worker.';

COMMENT ON COLUMN public.employee_timesheet_entries.regular_minutes IS
  'Worked minutes that count toward the weekly regular total.';

COMMENT ON COLUMN public.employee_timesheet_entries.overtime_minutes IS
  'Worked minutes that count as overtime for this date.';

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_tenant_date_idx
  ON public.employee_timesheet_entries (tenant_id, work_date);

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_facility_id_idx
  ON public.employee_timesheet_entries (facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_timesheet_entries_department_id_idx
  ON public.employee_timesheet_entries (department_id)
  WHERE department_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_employee_timesheet_entry_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_worker_tenant uuid;
  v_facility_tenant uuid;
  v_department_tenant uuid;
BEGIN
  SELECT tenant_id
  INTO v_worker_tenant
  FROM public.workers
  WHERE id = NEW.worker_id;

  IF v_worker_tenant IS NULL OR v_worker_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Employee does not belong to this organization';
  END IF;

  IF NEW.facility_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_facility_tenant
    FROM public.facility
    WHERE id = NEW.facility_id;

    IF v_facility_tenant IS NULL OR v_facility_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Facility does not belong to this organization';
    END IF;
  END IF;

  IF NEW.department_id IS NOT NULL THEN
    SELECT tenant_id
    INTO v_department_tenant
    FROM public.departments
    WHERE id = NEW.department_id;

    IF v_department_tenant IS NULL OR v_department_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Department does not belong to this organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_employee_timesheet_entry_scope() IS
  'Rejects a timesheet entry whose employee, facility, or department belongs to another tenant.';

REVOKE ALL ON FUNCTION public.assert_employee_timesheet_entry_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_employee_timesheet_entry_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_employee_timesheet_entry_scope() TO authenticated, service_role;

CREATE TRIGGER trg_employee_timesheet_entries_assert_scope
  BEFORE INSERT OR UPDATE OF tenant_id, worker_id, facility_id, department_id
  ON public.employee_timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_employee_timesheet_entry_scope();

CREATE TRIGGER trg_employee_timesheet_entries_set_updated_at
  BEFORE UPDATE ON public.employee_timesheet_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_timesheet_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY employee_timesheet_entries_staff_select
  ON public.employee_timesheet_entries
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

CREATE POLICY employee_timesheet_entries_staff_write
  ON public.employee_timesheet_entries
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR (SELECT public.user_is_tenant_staff(tenant_id))
  );

REVOKE ALL ON TABLE public.employee_timesheet_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_timesheet_entries TO authenticated;
GRANT ALL ON TABLE public.employee_timesheet_entries TO service_role;

NOTIFY pgrst, 'reload schema';

$source$; END IF; END $bundle$;

-- Feature resolution source: 20261116141533_edition_feature_resolution.sql
DO $bundle$ BEGIN IF to_regclass('public.edition_features') IS NULL THEN EXECUTE $source$
-- Reuse the existing product category instead of introducing a competing edition.
-- Existing categories were defaulted to Staffing, so require explicit review.
ALTER TABLE public.tenant_categories ADD COLUMN edition_set_at timestamptz;

CREATE TABLE public.edition_features (
  feature_key text PRIMARY KEY CHECK (feature_key ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  smb_default boolean NOT NULL DEFAULT false,
  staffing_default boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tenant_feature_overrides (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.edition_features(feature_key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  notes text CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);
CREATE INDEX tenant_feature_overrides_feature_idx ON public.tenant_feature_overrides(feature_key);

INSERT INTO public.edition_features(feature_key, label, description, smb_default, staffing_default) VALUES
  ('manage_clients', 'Manage clients', 'Client management and client columns', false, true),
  ('bill_rates', 'Bill rates', 'Client billing rates', false, true),
  ('multi_client_assignments', 'Multi-client assignments', 'Assign workers across clients', false, true),
  ('internal_scheduling', 'Internal scheduling', 'Schedule the tenant internal workforce', true, true),
  ('timesheets', 'Timesheets', 'Track and review working time', true, true),
  ('hiring_pipeline', 'Hiring pipeline', 'Job requisitions and applicant pipeline', true, true),
  ('hiring_ai', 'Hiring AI', 'Requires separate eligibility review before enabling', false, false);

ALTER TABLE public.edition_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY edition_features_read ON public.edition_features FOR SELECT TO authenticated USING (true);
CREATE POLICY tenant_feature_overrides_read ON public.tenant_feature_overrides
  FOR SELECT TO authenticated USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
    OR public.user_is_tenant_staff(tenant_id)
  );

-- Writes go through validated server APIs and the existing module grants.
REVOKE ALL ON public.edition_features, public.tenant_feature_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.edition_features, public.tenant_feature_overrides TO authenticated;
GRANT ALL ON public.edition_features, public.tenant_feature_overrides TO service_role;

CREATE VIEW public.tenant_effective_features WITH (security_invoker = true) AS
SELECT c.tenant_id, lower(c.category) AS edition, f.feature_key,
  coalesce(o.enabled, CASE c.category WHEN 'SMB' THEN f.smb_default ELSE f.staffing_default END) AS enabled
FROM public.tenant_categories c
CROSS JOIN public.edition_features f
LEFT JOIN public.tenant_feature_overrides o ON o.tenant_id = c.tenant_id AND o.feature_key = f.feature_key
WHERE c.edition_set_at IS NOT NULL;
REVOKE ALL ON public.tenant_effective_features FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tenant_effective_features TO authenticated, service_role;

COMMENT ON COLUMN public.tenant_categories.edition_set_at IS
  'Explicit edition classification time. NULL means legacy category has not been reviewed; never mass-backfill from default Staffing values.';
NOTIFY pgrst, 'reload schema';

$source$; END IF; END $bundle$;

DO $bundle$ BEGIN IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='parent_department_id') THEN EXECUTE $source$
-- Extend the existing department catalog; no replacement department system.
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.departments ADD COLUMN parent_department_id uuid;
CREATE UNIQUE INDEX departments_tenant_id_uidx ON public.departments(tenant_id, id);
ALTER TABLE public.departments ADD CONSTRAINT departments_parent_same_tenant_fk
  FOREIGN KEY (tenant_id, parent_department_id) REFERENCES public.departments(tenant_id, id);
ALTER TABLE public.departments ADD CONSTRAINT departments_code_length
  CHECK (code IS NULL OR char_length(btrim(code)) BETWEEN 1 AND 40);
CREATE INDEX departments_parent_idx ON public.departments(tenant_id, parent_department_id)
  WHERE parent_department_id IS NOT NULL;

CREATE FUNCTION public.assert_department_hierarchy() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Serialize changes to one tenant hierarchy to prevent concurrent cycles.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.tenant_id::text, 781));
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Department tenant cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.parent_department_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments d
      WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.parent_department_id) THEN
      RAISE EXCEPTION 'Parent department not found in tenant' USING ERRCODE = '23503';
    END IF;
    IF NEW.parent_department_id = NEW.id OR EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT d.id, d.parent_department_id FROM public.departments d
        WHERE d.tenant_id = NEW.tenant_id AND d.id = NEW.parent_department_id
        UNION
        SELECT d.id, d.parent_department_id FROM public.departments d
        JOIN ancestors a ON a.parent_department_id = d.id
        WHERE d.tenant_id = NEW.tenant_id
      ) SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Department hierarchy cannot contain a cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_department_hierarchy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_department_hierarchy() TO authenticated, service_role;
CREATE TRIGGER trg_departments_hierarchy BEFORE INSERT OR UPDATE OF tenant_id, parent_department_id
ON public.departments FOR EACH ROW EXECUTE FUNCTION public.assert_department_hierarchy();
NOTIFY pgrst, 'reload schema';


$source$; END IF; END $bundle$;
