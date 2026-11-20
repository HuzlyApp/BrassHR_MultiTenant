-- One signup-intent response per tenant; completion is separate from the six setup tasks.
CREATE TABLE public.tenant_signup_interests (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  interest_keys text[] NOT NULL DEFAULT '{}'::text[],
  skipped boolean NOT NULL DEFAULT false,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_signup_interests_known_keys CHECK (
    interest_keys <@ ARRAY['hr_data_reporting','time_attendance','hiring_onboarding','performance_management','compensation_planning','ai_powered_hr']::text[]
    AND array_position(interest_keys, NULL) IS NULL
    AND cardinality(interest_keys) <= 6
  ),
  CONSTRAINT tenant_signup_interests_response CHECK (
    (skipped AND cardinality(interest_keys) = 0)
    OR (NOT skipped AND cardinality(interest_keys) > 0)
  )
);

ALTER TABLE public.tenant_signup_interests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_signup_interests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_signup_interests TO service_role;

COMMENT ON TABLE public.tenant_signup_interests IS
  'Reasons a tenant owner signed up. Server-only tenant-admin API records stable interest keys or an explicit skip.';
