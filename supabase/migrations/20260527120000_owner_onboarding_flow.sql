-- Owner signup + tenant provisioning flow flags on public.users

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.users.signup_completed_at IS
  'Set when the Braas HR owner completes account signup (before tenant provisioning).';
COMMENT ON COLUMN public.users.tenant_onboarding_completed_at IS
  'Set when the owner finishes tenant onboarding and may access recruiter admin.';

-- Existing admins with a tenant are treated as fully onboarded
UPDATE public.users u
SET
  signup_completed_at = COALESCE(u.signup_completed_at, now()),
  tenant_onboarding_completed_at = COALESCE(u.tenant_onboarding_completed_at, now())
WHERE
  u.tenant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
      AND ur.role = 'admin'
  );
