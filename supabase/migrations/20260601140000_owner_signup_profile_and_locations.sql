-- Owner signup: extend existing public.users + reference tables for signup UI.
--
-- Prerequisites (already in your project):
--   public.users with id uuid PK → auth.users(id), tenant_id nullable, role app_role, etc.
-- Does NOT create or replace public.users — only adds missing columns safely.
--
-- App mapping (POST /api/auth/signup → public.users):
--   first_name, last_name, email, role = 'admin', email_verified, signup_completed_at
--   job_title, address_line1, address_line2, city, state, zip_code

-- ---------------------------------------------------------------------------
-- 1) public.users — signup profile columns (skip if already present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION 'public.users must exist before this migration (run base schema first).';
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_onboarding_completed_at timestamptz;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS job_title text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address_line1 text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address_line2 text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS zip_code text;

COMMENT ON COLUMN public.users.signup_completed_at IS
  'Set when the Braas HR owner completes account signup (before tenant provisioning).';
COMMENT ON COLUMN public.users.tenant_onboarding_completed_at IS
  'Set when the owner finishes tenant onboarding and may access recruiter admin.';
COMMENT ON COLUMN public.users.job_title IS
  'Owner/recruiter job title captured at Braas HR signup.';
COMMENT ON COLUMN public.users.address_line1 IS
  'Primary street address from owner signup.';
COMMENT ON COLUMN public.users.address_line2 IS
  'Secondary address line from owner signup.';
COMMENT ON COLUMN public.users.city IS
  'City from owner signup.';
COMMENT ON COLUMN public.users.state IS
  'US state name from owner signup (matches signup_us_states.name).';
COMMENT ON COLUMN public.users.zip_code IS
  'Postal code from owner signup.';

-- ---------------------------------------------------------------------------
-- 2) Reference tables for signup State / City dropdowns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signup_us_states (
  code char(2) NOT NULL,
  name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  CONSTRAINT signup_us_states_pkey PRIMARY KEY (code),
  CONSTRAINT signup_us_states_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.signup_us_cities (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  state_code char(2) NOT NULL,
  city_name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  CONSTRAINT signup_us_cities_pkey PRIMARY KEY (id),
  CONSTRAINT signup_us_cities_state_city_unique UNIQUE (state_code, city_name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signup_us_cities_state_code_fkey'
  ) THEN
    ALTER TABLE public.signup_us_cities
      ADD CONSTRAINT signup_us_cities_state_code_fkey
      FOREIGN KEY (state_code)
      REFERENCES public.signup_us_states (code)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS signup_us_cities_state_code_idx
  ON public.signup_us_cities (state_code);

COMMENT ON TABLE public.signup_us_states IS
  'US states for Braas HR owner signup dropdowns.';
COMMENT ON TABLE public.signup_us_cities IS
  'Cities per state for Braas HR owner signup dropdowns.';

-- ---------------------------------------------------------------------------
-- 3) Seed reference data (safe to re-run)
-- ---------------------------------------------------------------------------
INSERT INTO public.signup_us_states (code, name, sort_order) VALUES
  ('AL', 'Alabama', 1),
  ('AK', 'Alaska', 2),
  ('AZ', 'Arizona', 3),
  ('AR', 'Arkansas', 4),
  ('CA', 'California', 5),
  ('CO', 'Colorado', 6),
  ('CT', 'Connecticut', 7),
  ('DE', 'Delaware', 8),
  ('FL', 'Florida', 9),
  ('GA', 'Georgia', 10),
  ('HI', 'Hawaii', 11),
  ('ID', 'Idaho', 12),
  ('IL', 'Illinois', 13),
  ('IN', 'Indiana', 14),
  ('IA', 'Iowa', 15),
  ('KS', 'Kansas', 16),
  ('KY', 'Kentucky', 17),
  ('LA', 'Louisiana', 18),
  ('ME', 'Maine', 19),
  ('MD', 'Maryland', 20),
  ('MA', 'Massachusetts', 21),
  ('MI', 'Michigan', 22),
  ('MN', 'Minnesota', 23),
  ('MS', 'Mississippi', 24),
  ('MO', 'Missouri', 25),
  ('MT', 'Montana', 26),
  ('NE', 'Nebraska', 27),
  ('NV', 'Nevada', 28),
  ('NH', 'New Hampshire', 29),
  ('NJ', 'New Jersey', 30),
  ('NM', 'New Mexico', 31),
  ('NY', 'New York', 32),
  ('NC', 'North Carolina', 33),
  ('ND', 'North Dakota', 34),
  ('OH', 'Ohio', 35),
  ('OK', 'Oklahoma', 36),
  ('OR', 'Oregon', 37),
  ('PA', 'Pennsylvania', 38),
  ('RI', 'Rhode Island', 39),
  ('SC', 'South Carolina', 40),
  ('SD', 'South Dakota', 41),
  ('TN', 'Tennessee', 42),
  ('TX', 'Texas', 43),
  ('UT', 'Utah', 44),
  ('VT', 'Vermont', 45),
  ('VA', 'Virginia', 46),
  ('WA', 'Washington', 47),
  ('WV', 'West Virginia', 48),
  ('WI', 'Wisconsin', 49),
  ('WY', 'Wyoming', 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.signup_us_cities (state_code, city_name, sort_order) VALUES
  ('CA', 'Los Angeles', 1),
  ('CA', 'San Diego', 2),
  ('CA', 'San Francisco', 3),
  ('CA', 'Sacramento', 4),
  ('CA', 'San Jose', 5),
  ('AZ', 'Phoenix', 1),
  ('AZ', 'Tucson', 2),
  ('AZ', 'Mesa', 3),
  ('TX', 'Houston', 1),
  ('TX', 'Dallas', 2),
  ('TX', 'Austin', 3),
  ('TX', 'San Antonio', 4),
  ('NY', 'New York', 1),
  ('NY', 'Buffalo', 2),
  ('NY', 'Rochester', 3),
  ('FL', 'Miami', 1),
  ('FL', 'Orlando', 2),
  ('FL', 'Tampa', 3),
  ('IL', 'Chicago', 1),
  ('IL', 'Springfield', 2),
  ('WA', 'Seattle', 1),
  ('WA', 'Spokane', 2),
  ('CO', 'Denver', 1),
  ('GA', 'Atlanta', 1),
  ('NC', 'Charlotte', 1),
  ('PA', 'Philadelphia', 1),
  ('OH', 'Columbus', 1),
  ('MI', 'Detroit', 1),
  ('NV', 'Las Vegas', 1)
ON CONFLICT (state_code, city_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) RLS + API read access for signup dropdowns (no DROP — safe for Supabase SQL editor)
-- ---------------------------------------------------------------------------
ALTER TABLE public.signup_us_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_us_cities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signup_us_states'
      AND policyname = 'signup_us_states_public_read'
  ) THEN
    CREATE POLICY signup_us_states_public_read
      ON public.signup_us_states
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signup_us_cities'
      AND policyname = 'signup_us_cities_public_read'
  ) THEN
    CREATE POLICY signup_us_cities_public_read
      ON public.signup_us_cities
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.signup_us_states TO anon, authenticated;
GRANT SELECT ON public.signup_us_cities TO anon, authenticated;
