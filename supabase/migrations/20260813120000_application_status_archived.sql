-- Add "archived" as a system application status for candidate archive workflow.
-- Frontend archive action maps applicants to this status; archived tab lists them.

ALTER TABLE public.application_statuses
  DROP CONSTRAINT IF EXISTS application_statuses_system_key_chk;

ALTER TABLE public.application_statuses
  ADD CONSTRAINT application_statuses_system_key_chk CHECK (
    system_key IS NULL
    OR system_key IN (
      'new',
      'reviewing',
      'interviewing',
      'rejected',
      'hired',
      'shortlisted',
      'undecided',
      'withdrawn',
      'archived'
    )
  );

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_chk;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_chk CHECK (
    status IN (
      'new',
      'reviewing',
      'interviewing',
      'rejected',
      'hired',
      'shortlisted',
      'undecided',
      'archived',
      'in_progress',
      'submitted',
      'withdrawn',
      'custom'
    )
  );

CREATE OR REPLACE FUNCTION public.ensure_default_application_statuses(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_defaults text[][] := ARRAY[
    ARRAY['new', 'New', '0'],
    ARRAY['reviewing', 'Reviewing', '1'],
    ARRAY['shortlisted', 'Shortlisted', '2'],
    ARRAY['interviewing', 'Interviewing', '3'],
    ARRAY['undecided', 'Undecided', '4'],
    ARRAY['hired', 'Hired', '5'],
    ARRAY['rejected', 'Rejected', '6'],
    ARRAY['archived', 'Archived', '7']
  ];
  v_row text[];
  v_has_any boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.application_statuses s WHERE s.tenant_id = p_tenant_id
  ) INTO v_has_any;

  IF v_has_any THEN
    FOREACH v_row SLICE 1 IN ARRAY v_defaults LOOP
      INSERT INTO public.application_statuses (
        tenant_id, name, system_key, sort_order, is_active, is_default
      )
      SELECT
        p_tenant_id,
        v_row[2],
        v_row[1],
        v_row[3]::integer,
        true,
        (v_row[1] = 'new')
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.application_statuses s
        WHERE s.tenant_id = p_tenant_id
          AND s.system_key = v_row[1]
      );
    END LOOP;
    RETURN;
  END IF;

  FOREACH v_row SLICE 1 IN ARRAY v_defaults LOOP
    INSERT INTO public.application_statuses (
      tenant_id, name, system_key, sort_order, is_active, is_default
    ) VALUES (
      p_tenant_id,
      v_row[2],
      v_row[1],
      v_row[3]::integer,
      true,
      (v_row[1] = 'new')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_application_statuses(uuid) TO service_role;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_default_application_statuses(t.id);
  END LOOP;
END $$;
