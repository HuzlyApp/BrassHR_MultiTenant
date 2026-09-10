-- Service area gates (BRASSHR-FS-GEO-001).
-- Restrict where jobs can be posted, where applicants can apply, and where
-- tenants can go live. Decision is on confirmed work location, not home address
-- or visitor IP. Platform hold list is not exposed to applicants.

-- ---------------------------------------------------------------------------
-- Tenant + job columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS hq_state text,
  ADD COLUMN IF NOT EXISTS primary_city text,
  ADD COLUMN IF NOT EXISTS primary_state text,
  ADD COLUMN IF NOT EXISTS primary_postal_code text,
  ADD COLUMN IF NOT EXISTS account_access text,
  ADD COLUMN IF NOT EXISTS hq_in_hold boolean NOT NULL DEFAULT false;

UPDATE public.tenants
SET account_access = 'active_trial'
WHERE account_access IS NULL;

ALTER TABLE public.tenants
  ALTER COLUMN account_access SET DEFAULT 'active_trial';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_account_access_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_account_access_check
      CHECK (account_access = ANY (ARRAY['active_trial', 'waitlist_pending']));
  END IF;
END $$;

COMMENT ON COLUMN public.tenants.account_access IS
  'active_trial = product access; waitlist_pending = primary work location is on platform hold.';
COMMENT ON COLUMN public.tenants.hq_in_hold IS
  'Support-only flag: headquarters state is on platform hold while primary work location is allowed.';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hq_state text,
  ADD COLUMN IF NOT EXISTS primary_city text,
  ADD COLUMN IF NOT EXISTS primary_state text,
  ADD COLUMN IF NOT EXISTS primary_postal_code text,
  ADD COLUMN IF NOT EXISTS signup_waitlist_pending boolean NOT NULL DEFAULT false;

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS worksite_city text,
  ADD COLUMN IF NOT EXISTS worksite_state text,
  ADD COLUMN IF NOT EXISTS worksite_postal_code text,
  ADD COLUMN IF NOT EXISTS worksite_country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS remote_allowed_states text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_area_status text;

UPDATE public.job_requisitions
SET service_area_status = 'unchecked'
WHERE service_area_status IS NULL;

ALTER TABLE public.job_requisitions
  ALTER COLUMN service_area_status SET DEFAULT 'unchecked';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_requisitions_service_area_status_check'
      AND conrelid = 'public.job_requisitions'::regclass
  ) THEN
    ALTER TABLE public.job_requisitions
      ADD CONSTRAINT job_requisitions_service_area_status_check
      CHECK (service_area_status = ANY (ARRAY['ok', 'blocked', 'unchecked']));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Platform + tenant policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_area_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  match_type text NOT NULL,
  states text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  postal_codes text[] NOT NULL DEFAULT '{}',
  effect text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  message_key text NOT NULL DEFAULT 'location_not_available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_area_policies_source_check CHECK (source = ANY (ARRAY['platform', 'tenant'])),
  CONSTRAINT service_area_policies_match_type_check CHECK (
    match_type = ANY (ARRAY['state', 'city_state', 'postal_prefix', 'zip_list', 'custom'])
  ),
  CONSTRAINT service_area_policies_effect_check CHECK (effect = ANY (ARRAY['hold', 'allow'])),
  CONSTRAINT service_area_policies_platform_null_tenant CHECK (
    (source = 'platform' AND tenant_id IS NULL)
    OR (source = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_policy_code
  ON public.service_area_policies (code)
  WHERE source = 'platform';

CREATE INDEX IF NOT EXISTS idx_sa_policy_tenant
  ON public.service_area_policies (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sa_policy_active_source
  ON public.service_area_policies (source, is_active)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.service_area_zips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.service_area_policies (id) ON DELETE CASCADE,
  postal_code text NOT NULL,
  UNIQUE (policy_id, postal_code)
);

CREATE INDEX IF NOT EXISTS idx_sa_zips_postal
  ON public.service_area_zips (postal_code);

CREATE INDEX IF NOT EXISTS idx_sa_zips_policy
  ON public.service_area_zips (policy_id);

CREATE TABLE IF NOT EXISTS public.tenant_hiring_areas (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'locations_only',
  extra_allowed_states text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_hiring_areas_mode_check CHECK (
    mode = ANY (ARRAY['locations_only', 'locations_plus_states', 'all_allowed_platform'])
  )
);

CREATE TABLE IF NOT EXISTS public.work_location_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  applicant_id uuid,
  source text NOT NULL,
  home_city text,
  home_state text,
  home_postal_code text,
  work_city text,
  work_state text,
  work_postal_code text,
  location_type text,
  relocate_to_job_site boolean NOT NULL DEFAULT false,
  decision text NOT NULL,
  reason_code text NOT NULL,
  message_key text,
  policy_id uuid REFERENCES public.service_area_policies (id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_location_confirmations_source_check CHECK (
    source = ANY (ARRAY['apply', 'recruiter_upload', 'signup', 'add_location', 'worker_move'])
  )
);

CREATE INDEX IF NOT EXISTS idx_wlc_tenant_created
  ON public.work_location_confirmations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wlc_job
  ON public.work_location_confirmations (job_id);

CREATE TABLE IF NOT EXISTS public.service_area_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  action text NOT NULL,
  work_city text,
  work_state text,
  work_postal_code text,
  location_type text,
  relocate_to_job_site boolean NOT NULL DEFAULT false,
  allowed boolean NOT NULL,
  reason_code text NOT NULL,
  message_key text,
  layer text,
  policy_id uuid REFERENCES public.service_area_policies (id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sa_decisions_tenant_created
  ON public.service_area_decisions (tenant_id, created_at DESC)
  WHERE allowed = false;

CREATE TABLE IF NOT EXISTS public.service_area_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  city text,
  state text,
  source text NOT NULL,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.job_requisitions (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_area_waitlist_source_check CHECK (source = ANY (ARRAY['apply', 'signup']))
);

CREATE INDEX IF NOT EXISTS idx_sa_waitlist_created
  ON public.service_area_waitlist (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sa_waitlist_email
  ON public.service_area_waitlist (lower(email));

CREATE TABLE IF NOT EXISTS public.service_area_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sa_overrides_tenant
  ON public.service_area_overrides (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS set_service_area_policies_updated_at ON public.service_area_policies;
CREATE TRIGGER set_service_area_policies_updated_at
BEFORE UPDATE ON public.service_area_policies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_tenant_hiring_areas_updated_at ON public.tenant_hiring_areas;
CREATE TRIGGER set_tenant_hiring_areas_updated_at
BEFORE UPDATE ON public.tenant_hiring_areas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed platform holds: CA, IL, CT (entire state) + NYC (city/ZIP)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_area_policies (
  source, tenant_id, code, label, match_type, states, cities, effect, is_active, message_key
)
SELECT v.source, v.tenant_id, v.code, v.label, v.match_type, v.states, v.cities, v.effect, v.is_active, v.message_key
FROM (
  VALUES
    ('platform', NULL::uuid, 'CA', 'California', 'state', ARRAY['CA']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    ('platform', NULL::uuid, 'IL', 'Illinois', 'state', ARRAY['IL']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    ('platform', NULL, 'CT', 'Connecticut', 'state', ARRAY['CT']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    (
      'platform',
      NULL,
      'NYC',
      'New York City',
      'city_state',
      ARRAY['NY']::text[],
      ARRAY[
        'new york',
        'new york city',
        'nyc',
        'manhattan',
        'brooklyn',
        'queens',
        'bronx',
        'the bronx',
        'staten island'
      ]::text[],
      'hold',
      true,
      'location_not_available'
    )
) AS v(source, tenant_id, code, label, match_type, states, cities, effect, is_active, message_key)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_area_policies p
  WHERE p.source = 'platform' AND p.code = v.code
);

-- Official five-borough ZIP coverage (unused codes in a range are harmless;
-- Nassau 11001 / 11040 are intentionally excluded).
INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10001, 10007) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10009, 10014) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10016, 10041) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, unnest(ARRAY['10044', '10045', '10055', '10065', '10069', '10075', '10080', '10081'])
FROM public.service_area_policies p
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10101, 10199) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10270, 10286) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10301, 10314) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10451, 10475) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, unnest(ARRAY['11004', '11005'])
FROM public.service_area_policies p
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11101, 11109) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11201, 11256) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11351, 11385) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11411, 11436) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11691, 11697) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: applicants never read policy rows. Engine uses service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_area_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_zips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_hiring_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_location_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_area_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_zips FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_hiring_areas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_location_confirmations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_waitlist FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_area_overrides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_policies_godadmin_all ON public.service_area_policies;
CREATE POLICY sa_policies_godadmin_all
  ON public.service_area_policies
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS sa_zips_godadmin_all ON public.service_area_zips;
CREATE POLICY sa_zips_godadmin_all
  ON public.service_area_zips
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS tenant_hiring_areas_staff_select ON public.tenant_hiring_areas;
CREATE POLICY tenant_hiring_areas_staff_select
  ON public.tenant_hiring_areas
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS tenant_hiring_areas_admin_write ON public.tenant_hiring_areas;
CREATE POLICY tenant_hiring_areas_admin_write
  ON public.tenant_hiring_areas
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS wlc_staff_select ON public.work_location_confirmations;
CREATE POLICY wlc_staff_select
  ON public.work_location_confirmations
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS sa_decisions_staff_select ON public.service_area_decisions;
CREATE POLICY sa_decisions_staff_select
  ON public.service_area_decisions
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR (tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id))
  );

DROP POLICY IF EXISTS sa_waitlist_godadmin_select ON public.service_area_waitlist;
CREATE POLICY sa_waitlist_godadmin_select
  ON public.service_area_waitlist
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS sa_overrides_godadmin_all ON public.service_area_overrides;
CREATE POLICY sa_overrides_godadmin_all
  ON public.service_area_overrides
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

GRANT SELECT ON public.tenant_hiring_areas TO authenticated;
GRANT INSERT, UPDATE ON public.tenant_hiring_areas TO authenticated;
GRANT SELECT ON public.work_location_confirmations TO authenticated;
GRANT SELECT ON public.service_area_decisions TO authenticated;
GRANT SELECT ON public.service_area_policies TO authenticated;
GRANT SELECT ON public.service_area_zips TO authenticated;
GRANT SELECT ON public.service_area_waitlist TO authenticated;
GRANT SELECT, INSERT ON public.service_area_overrides TO authenticated;

GRANT ALL ON public.service_area_policies, public.service_area_zips, public.tenant_hiring_areas,
  public.work_location_confirmations, public.service_area_decisions, public.service_area_waitlist,
  public.service_area_overrides
  TO service_role;

COMMENT ON TABLE public.service_area_policies IS
  'Platform hold and tenant allow policies. Clients must not ship this list; evaluate() is the only public API.';
COMMENT ON TABLE public.service_area_decisions IS
  'Append-only evaluate audit. Denies are logged; no inferred demographics.';
