-- Deterministic display order for onboarding flows

ALTER TABLE public.onboarding_flows
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS onboarding_flows_library_sort_idx
  ON public.onboarding_flows (library_id, sort_order ASC, created_at DESC);

-- Backfill sort order for seeded onboarding library flows (per tenant)
DO $$
DECLARE
  r record;
  v_library_id uuid;
BEGIN
  FOR r IN SELECT id AS tenant_id FROM public.tenants LOOP
    SELECT id INTO v_library_id
    FROM public.onboarding_libraries
    WHERE tenant_id = r.tenant_id AND slug = 'onboarding'
    LIMIT 1;

    IF v_library_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.onboarding_flows f
    SET sort_order = v.ord
    FROM (
      VALUES
        ('Pre-Offer (ATS)', 1),
        ('Post-Offer', 2),
        ('Final Offer', 3),
        ('Employee Account Setup', 4),
        ('New Hire Orientation', 5),
        ('HR Document Verification', 6),
        ('IT Equipment Provisioning', 7),
        ('Payroll Enrollment', 8),
        ('Background Check Approval', 9),
        ('Department Introduction', 10),
        ('Training & Compliance', 11),
        ('Benefits Registration', 12),
        ('Manager Approval', 13),
        ('Facility Assignment', 14)
    ) AS v(name, ord)
    WHERE f.tenant_id = r.tenant_id
      AND f.library_id = v_library_id
      AND f.name = v.name;
  END LOOP;
END;
$$;
