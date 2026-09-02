-- Canonical recruiting status catalog (names + order) for new and existing tenants.
-- Extra statuses keep system_key NULL so they do not violate application_statuses_system_key_chk.
-- hired stays on "Selected by Client" so post-hire activation is unchanged.

CREATE OR REPLACE FUNCTION public.ensure_default_application_statuses(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_defaults text[][] := ARRAY[
    ARRAY['new', 'New / Not Contacted', '0'],
    ARRAY['', 'Attempted Contact', '1'],
    ARRAY['', 'Follow-up Needed', '2'],
    ARRAY['', 'Unreachable', '3'],
    ARRAY['reviewing', 'Screening Complete', '4'],
    ARRAY['shortlisted', E'Qualified ' || chr(8211) || ' Ready for Interview', '5'],
    ARRAY['interviewing', 'Interview Complete', '6'],
    ARRAY['', 'Profile Ready', '7'],
    ARRAY['', 'Submitted for MSP Review', '8'],
    ARRAY['', 'Presented to Client', '9'],
    ARRAY['', 'Selected', '10'],
    ARRAY['', 'Approved by MSP', '11'],
    ARRAY['hired', 'Selected by Client', '12'],
    ARRAY['undecided', 'Fit for Future Roles', '13'],
    ARRAY['withdrawn', 'Candidate Withdrew', '14'],
    ARRAY['rejected', 'Not a Fit', '15'],
    ARRAY['', 'Rejected After Interview', '16'],
    ARRAY['', 'Rejected by MSP', '17'],
    ARRAY['', 'Rejected by Client', '18'],
    ARRAY['archived', 'Position Closed', '19']
  ];
  v_row text[];
  v_key text;
  v_name text;
  v_sort integer;
BEGIN
  FOREACH v_row SLICE 1 IN ARRAY v_defaults LOOP
    v_key := NULLIF(btrim(v_row[1]), '');
    v_name := v_row[2];
    v_sort := v_row[3]::integer;

    INSERT INTO public.application_statuses (
      tenant_id, name, system_key, sort_order, is_active, is_default
    )
    SELECT
      p_tenant_id,
      v_name,
      v_key,
      v_sort,
      true,
      COALESCE(v_key = 'new', false)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.application_statuses s
      WHERE s.tenant_id = p_tenant_id
        AND (
          (v_key IS NOT NULL AND s.system_key = v_key)
          OR lower(btrim(s.name)) = lower(btrim(v_name))
        )
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_application_statuses(uuid) TO service_role;

-- Align existing system-key rows to the new names and sort order, then insert missing defaults.
UPDATE public.application_statuses
SET
  name = CASE system_key
    WHEN 'new' THEN 'New / Not Contacted'
    WHEN 'reviewing' THEN 'Screening Complete'
    WHEN 'shortlisted' THEN E'Qualified ' || chr(8211) || ' Ready for Interview'
    WHEN 'interviewing' THEN 'Interview Complete'
    WHEN 'hired' THEN 'Selected by Client'
    WHEN 'undecided' THEN 'Fit for Future Roles'
    WHEN 'withdrawn' THEN 'Candidate Withdrew'
    WHEN 'rejected' THEN 'Not a Fit'
    WHEN 'archived' THEN 'Position Closed'
    ELSE name
  END,
  sort_order = CASE system_key
    WHEN 'new' THEN 0
    WHEN 'reviewing' THEN 4
    WHEN 'shortlisted' THEN 5
    WHEN 'interviewing' THEN 6
    WHEN 'hired' THEN 12
    WHEN 'undecided' THEN 13
    WHEN 'withdrawn' THEN 14
    WHEN 'rejected' THEN 15
    WHEN 'archived' THEN 19
    ELSE sort_order
  END,
  is_default = (system_key = 'new'),
  updated_at = now()
WHERE system_key IN (
  'new',
  'reviewing',
  'shortlisted',
  'interviewing',
  'hired',
  'undecided',
  'withdrawn',
  'rejected',
  'archived'
);

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_default_application_statuses(t.id);
  END LOOP;
END $$;
