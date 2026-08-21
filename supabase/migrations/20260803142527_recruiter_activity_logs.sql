-- Recruiter Activity: productivity CRM event log + tenant settings.
-- Attribution always comes from authenticated server session (recruiter_user_id).

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS assigned_recruiter_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS worker_assigned_recruiter_user_id_idx
  ON public.worker (tenant_id, assigned_recruiter_user_id)
  WHERE assigned_recruiter_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.recruiter_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  recruiter_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  job_id uuid,
  analysis_id uuid,
  note_id uuid,
  activity_type text NOT NULL,
  action_label text NOT NULL,
  previous_value text,
  new_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'recruiter',
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_activity_logs_activity_type_not_empty
    CHECK (char_length(trim(activity_type)) > 0),
  CONSTRAINT recruiter_activity_logs_action_label_not_empty
    CHECK (char_length(trim(action_label)) > 0),
  CONSTRAINT recruiter_activity_logs_source_check
    CHECK (source = ANY (ARRAY['recruiter', 'tenant_admin', 'super_admin', 'system', 'migration', 'api']))
);

CREATE INDEX IF NOT EXISTS recruiter_activity_logs_tenant_idx
  ON public.recruiter_activity_logs (tenant_id);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_tenant_created_idx
  ON public.recruiter_activity_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_recruiter_idx
  ON public.recruiter_activity_logs (recruiter_user_id);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_recruiter_created_idx
  ON public.recruiter_activity_logs (recruiter_user_id, created_at DESC)
  WHERE recruiter_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_tenant_recruiter_created_idx
  ON public.recruiter_activity_logs (tenant_id, recruiter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_candidate_idx
  ON public.recruiter_activity_logs (candidate_id);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_job_idx
  ON public.recruiter_activity_logs (job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_activity_type_idx
  ON public.recruiter_activity_logs (activity_type);
CREATE INDEX IF NOT EXISTS recruiter_activity_logs_created_at_idx
  ON public.recruiter_activity_logs (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS recruiter_activity_logs_idempotency_uidx
  ON public.recruiter_activity_logs (tenant_id, request_id, activity_type)
  WHERE request_id IS NOT NULL;

COMMENT ON TABLE public.recruiter_activity_logs IS
  'Structured recruiter productivity events. recruiter_user_id must come from the authenticated session, never the client body.';

CREATE TABLE IF NOT EXISTS public.tenant_recruiter_activity_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/New_York',
  productivity_score_enabled boolean NOT NULL DEFAULT true,
  weight_candidates_worked numeric(5, 4) NOT NULL DEFAULT 0.20,
  weight_analyses_completed numeric(5, 4) NOT NULL DEFAULT 0.15,
  weight_notes_followups numeric(5, 4) NOT NULL DEFAULT 0.15,
  weight_status_progression numeric(5, 4) NOT NULL DEFAULT 0.20,
  weight_submitted numeric(5, 4) NOT NULL DEFAULT 0.15,
  weight_interviews_offers_hires numeric(5, 4) NOT NULL DEFAULT 0.15,
  successful_statuses text[] NOT NULL DEFAULT ARRAY[
    'for_approval',
    'approved',
    'qualified',
    'submitted',
    'interview_scheduled',
    'offer_extended',
    'hired'
  ],
  inactivity_hours_24 integer NOT NULL DEFAULT 24,
  inactivity_hours_3d integer NOT NULL DEFAULT 72,
  inactivity_hours_7d integer NOT NULL DEFAULT 168,
  same_status_hours integer NOT NULL DEFAULT 72,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT tenant_recruiter_activity_settings_weights_sum_check CHECK (
    abs(
      (
        weight_candidates_worked
        + weight_analyses_completed
        + weight_notes_followups
        + weight_status_progression
        + weight_submitted
        + weight_interviews_offers_hires
      ) - 1.0
    ) < 0.001
    OR productivity_score_enabled = false
  )
);

COMMENT ON TABLE public.tenant_recruiter_activity_settings IS
  'Per-tenant Recruiter Activity dashboard settings (weights, successful statuses, inactivity thresholds).';

ALTER TABLE public.recruiter_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_recruiter_activity_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recruiter_activity_logs_staff_select ON public.recruiter_activity_logs;
CREATE POLICY recruiter_activity_logs_staff_select
  ON public.recruiter_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS tenant_recruiter_activity_settings_staff ON public.tenant_recruiter_activity_settings;
CREATE POLICY tenant_recruiter_activity_settings_staff
  ON public.tenant_recruiter_activity_settings
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

GRANT SELECT, INSERT ON public.recruiter_activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_recruiter_activity_settings TO authenticated;
GRANT ALL ON public.recruiter_activity_logs, public.tenant_recruiter_activity_settings TO service_role;
