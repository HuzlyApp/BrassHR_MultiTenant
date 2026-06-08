-- Account section: tenant business fields, account_settings, account_checklist.
-- Reuses public.users (profile) and public.tenants (organization).

-- ---------------------------------------------------------------------------
-- 1) Tenant business columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS ein text;

COMMENT ON COLUMN public.tenants.legal_name IS 'Legal business name for account / billing.';
COMMENT ON COLUMN public.tenants.ein IS 'Employer Identification Number (EIN).';

-- Tenant members (via public.users.tenant_id) may update their organization row.
DROP POLICY IF EXISTS tenants_update_member ON public.tenants;
CREATE POLICY tenants_update_member
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT u.tenant_id
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT u.tenant_id
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 2) account_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/New_York',
  language text NOT NULL DEFAULT 'en',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  theme text NOT NULL DEFAULT 'system',
  email_notifications boolean NOT NULL DEFAULT true,
  sms_notifications boolean NOT NULL DEFAULT false,
  push_notifications boolean NOT NULL DEFAULT true,
  marketing_emails boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_settings_select_own ON public.account_settings;
CREATE POLICY account_settings_select_own
  ON public.account_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS account_settings_update_own ON public.account_settings;
CREATE POLICY account_settings_update_own
  ON public.account_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS account_settings_insert_own ON public.account_settings;
CREATE POLICY account_settings_insert_own
  ON public.account_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.account_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) account_checklist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_checklist (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  profile_completed boolean NOT NULL DEFAULT false,
  business_info_completed boolean NOT NULL DEFAULT false,
  account_settings_completed boolean NOT NULL DEFAULT false,
  security_completed boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT false,
  organization_created boolean NOT NULL DEFAULT false,
  payment_setup_completed boolean NOT NULL DEFAULT false,
  team_invited boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_checklist_select_own ON public.account_checklist;
CREATE POLICY account_checklist_select_own
  ON public.account_checklist
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS account_checklist_update_own ON public.account_checklist;
CREATE POLICY account_checklist_update_own
  ON public.account_checklist
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS account_checklist_insert_own ON public.account_checklist;
CREATE POLICY account_checklist_insert_own
  ON public.account_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.account_checklist TO authenticated;
