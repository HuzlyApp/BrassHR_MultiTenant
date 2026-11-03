-- Team Productivity KPI analytics foundation.
-- First-party session engagement + activity events + configurable KPI scorecards.
-- Does not store keystroke content, screenshots, or unrelated browsing activity.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_tenant_department_id_idx
  ON public.users (tenant_id, department_id)
  WHERE department_id IS NOT NULL;

COMMENT ON COLUMN public.users.department_id IS
  'Optional staff department for productivity analytics and filtering.';

CREATE TABLE IF NOT EXISTS public.analytics_tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  idle_threshold_seconds integer NOT NULL DEFAULT 300
    CHECK (idle_threshold_seconds BETWEEN 60 AND 86400),
  engagement_disclosure text NOT NULL DEFAULT
    'Engaged session time measures interaction with this application, not all work performed by the employee.',
  allow_manual_work_entries boolean NOT NULL DEFAULT true,
  weight_redistribution_policy text NOT NULL DEFAULT 'proportional'
    CHECK (weight_redistribution_policy = ANY (ARRAY['proportional', 'keep_gap', 'exclude_score'])),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.analytics_tenant_settings IS
  'Per-tenant analytics configuration (idle threshold, disclosures, scorecard policy).';

CREATE TABLE IF NOT EXISTS public.analytics_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_session_key text NOT NULL,
  department_id_at_start uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  role_at_start text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_meaningful_at timestamptz,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  end_reason text
    CHECK (
      end_reason IS NULL
      OR end_reason = ANY (
        ARRAY[
          'logout',
          'idle_timeout',
          'token_expired',
          'heartbeat_timeout',
          'replaced',
          'manual',
          'system'
        ]
      )
    ),
  is_active boolean NOT NULL DEFAULT true,
  logged_in_seconds integer NOT NULL DEFAULT 0 CHECK (logged_in_seconds >= 0),
  engaged_seconds integer NOT NULL DEFAULT 0 CHECK (engaged_seconds >= 0),
  idle_seconds integer NOT NULL DEFAULT 0 CHECK (idle_seconds >= 0),
  activity_count integer NOT NULL DEFAULT 0 CHECK (activity_count >= 0),
  module_at_start text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_user_sessions_end_after_start
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_user_sessions_active_client_uidx
  ON public.analytics_user_sessions (tenant_id, user_id, client_session_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS analytics_user_sessions_tenant_started_idx
  ON public.analytics_user_sessions (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS analytics_user_sessions_tenant_user_started_idx
  ON public.analytics_user_sessions (tenant_id, user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS analytics_user_sessions_tenant_active_idx
  ON public.analytics_user_sessions (tenant_id, is_active, last_heartbeat_at DESC)
  WHERE is_active = true;

COMMENT ON TABLE public.analytics_user_sessions IS
  'First-party authenticated application sessions for productivity analytics. Overlapping tabs share client_session_key dedupe via active unique index per key.';

CREATE TABLE IF NOT EXISTS public.analytics_session_engagement_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.analytics_user_sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  seconds integer NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  source text NOT NULL DEFAULT 'heartbeat'
    CHECK (source = ANY (ARRAY['heartbeat', 'activity', 'visibility', 'manual', 'system'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_session_engagement_intervals_end_after_start
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS analytics_session_engagement_intervals_session_idx
  ON public.analytics_session_engagement_intervals (session_id, started_at);

CREATE INDEX IF NOT EXISTS analytics_session_engagement_intervals_tenant_user_idx
  ON public.analytics_session_engagement_intervals (tenant_id, user_id, started_at DESC);

COMMENT ON TABLE public.analytics_session_engagement_intervals IS
  'Non-overlapping engaged intervals derived from meaningful interaction heartbeats.';

CREATE TABLE IF NOT EXISTS public.analytics_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  department_id_at_event uuid REFERENCES public.departments (id) ON DELETE SET NULL,
  role_at_event text,
  event_type text NOT NULL,
  module text NOT NULL DEFAULT 'general',
  entity_type text,
  entity_id uuid,
  job_id uuid,
  session_id uuid REFERENCES public.analytics_user_sessions (id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'server'
    CHECK (source = ANY (ARRAY['server', 'client', 'system', 'manual', 'backfill'])),
  attribution_type text NOT NULL DEFAULT 'actor'
    CHECK (
      attribution_type = ANY (
        ARRAY['actor', 'assignee', 'shared', 'system', 'manual']
      )
    ),
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT analytics_activity_events_event_type_not_empty
    CHECK (char_length(btrim(event_type)) > 0),
  CONSTRAINT analytics_activity_events_module_not_empty
    CHECK (char_length(btrim(module)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_activity_events_idempotency_uidx
  ON public.analytics_activity_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_activity_events_tenant_occurred_idx
  ON public.analytics_activity_events (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_activity_events_tenant_actor_occurred_idx
  ON public.analytics_activity_events (tenant_id, actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_activity_events_tenant_type_occurred_idx
  ON public.analytics_activity_events (tenant_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_activity_events_tenant_job_idx
  ON public.analytics_activity_events (tenant_id, job_id, occurred_at DESC)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_activity_events_tenant_department_idx
  ON public.analytics_activity_events (tenant_id, department_id_at_event, occurred_at DESC)
  WHERE department_id_at_event IS NOT NULL;

COMMENT ON TABLE public.analytics_activity_events IS
  'Meaningful application actions for KPI attribution. Avoid storing sensitive candidate/payroll payloads in metadata.';

CREATE TABLE IF NOT EXISTS public.analytics_kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments (id) ON DELETE CASCADE,
  applicable_roles text[] NOT NULL DEFAULT '{}'::text[],
  data_source text NOT NULL,
  numerator_expr text NOT NULL,
  denominator_expr text,
  aggregation text NOT NULL DEFAULT 'ratio'
    CHECK (aggregation = ANY (ARRAY['ratio', 'sum', 'avg', 'count', 'duration'])),
  unit text NOT NULL DEFAULT 'count',
  direction text NOT NULL DEFAULT 'higher_is_better'
    CHECK (direction = ANY (ARRAY['higher_is_better', 'lower_is_better'])),
  default_weight numeric(5, 4) NOT NULL DEFAULT 0,
  default_target numeric,
  reporting_period text NOT NULL DEFAULT 'custom'
    CHECK (reporting_period = ANY (ARRAY['day', 'week', 'month', 'quarter', 'year', 'custom'])),
  minimum_sample_size integer NOT NULL DEFAULT 1 CHECK (minimum_sample_size >= 0),
  ownership_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'managers'
    CHECK (visibility = ANY (ARRAY['self', 'managers', 'hr', 'admin', 'all_staff'])),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_kpi_definitions_key_not_empty
    CHECK (char_length(btrim(key)) > 0),
  CONSTRAINT analytics_kpi_definitions_name_not_empty
    CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_kpi_definitions_tenant_key_version_uidx
  ON public.analytics_kpi_definitions (tenant_id, key, version);

CREATE INDEX IF NOT EXISTS analytics_kpi_definitions_tenant_active_idx
  ON public.analytics_kpi_definitions (tenant_id, is_active, department_id);

CREATE TABLE IF NOT EXISTS public.analytics_kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  kpi_definition_id uuid NOT NULL REFERENCES public.analytics_kpi_definitions (id) ON DELETE CASCADE,
  scope_type text NOT NULL DEFAULT 'tenant'
    CHECK (scope_type = ANY (ARRAY['tenant', 'department', 'role', 'user'])),
  scope_id text,
  target_value numeric NOT NULL,
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS analytics_kpi_targets_tenant_kpi_idx
  ON public.analytics_kpi_targets (tenant_id, kpi_definition_id);

CREATE TABLE IF NOT EXISTS public.analytics_kpi_scorecard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid REFERENCES public.departments (id) ON DELETE CASCADE,
  applicable_roles text[] NOT NULL DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT analytics_kpi_scorecard_versions_name_not_empty
    CHECK (char_length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_kpi_scorecard_versions_uidx
  ON public.analytics_kpi_scorecard_versions (tenant_id, name, version);

CREATE TABLE IF NOT EXISTS public.analytics_kpi_scorecard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  scorecard_version_id uuid NOT NULL REFERENCES public.analytics_kpi_scorecard_versions (id) ON DELETE CASCADE,
  kpi_definition_id uuid NOT NULL REFERENCES public.analytics_kpi_definitions (id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  weight numeric(5, 4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  cap_attainment_pct numeric(7, 2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_kpi_scorecard_items_scorecard_idx
  ON public.analytics_kpi_scorecard_items (scorecard_version_id, sort_order);

CREATE TABLE IF NOT EXISTS public.analytics_report_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  report_key text NOT NULL DEFAULT 'team-productivity',
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_report_saved_views_name_not_empty
    CHECK (char_length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS analytics_report_saved_views_owner_idx
  ON public.analytics_report_saved_views (tenant_id, owner_user_id, report_key);

CREATE TABLE IF NOT EXISTS public.analytics_report_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  report_key text NOT NULL DEFAULT 'team-productivity',
  format text NOT NULL CHECK (format = ANY (ARRAY['csv', 'xlsx', 'pdf'])),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending', 'running', 'completed', 'failed'])),
  row_count integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS analytics_report_export_jobs_tenant_created_idx
  ON public.analytics_report_export_jobs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.analytics_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_audit_logs_tenant_created_idx
  ON public.analytics_audit_logs (tenant_id, created_at DESC);

-- Updated-at triggers
DROP TRIGGER IF EXISTS trg_analytics_user_sessions_set_updated_at ON public.analytics_user_sessions;
CREATE TRIGGER trg_analytics_user_sessions_set_updated_at
  BEFORE UPDATE ON public.analytics_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_analytics_kpi_definitions_set_updated_at ON public.analytics_kpi_definitions;
CREATE TRIGGER trg_analytics_kpi_definitions_set_updated_at
  BEFORE UPDATE ON public.analytics_kpi_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_analytics_kpi_targets_set_updated_at ON public.analytics_kpi_targets;
CREATE TRIGGER trg_analytics_kpi_targets_set_updated_at
  BEFORE UPDATE ON public.analytics_kpi_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_analytics_report_saved_views_set_updated_at ON public.analytics_report_saved_views;
CREATE TRIGGER trg_analytics_report_saved_views_set_updated_at
  BEFORE UPDATE ON public.analytics_report_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.analytics_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_tenant_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_session_engagement_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_session_engagement_intervals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_activity_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_targets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_scorecard_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_scorecard_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_scorecard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_kpi_scorecard_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_report_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_report_saved_views FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_report_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_report_export_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_audit_logs FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'analytics_tenant_settings',
    'analytics_user_sessions',
    'analytics_session_engagement_intervals',
    'analytics_activity_events',
    'analytics_kpi_definitions',
    'analytics_kpi_targets',
    'analytics_kpi_scorecard_versions',
    'analytics_kpi_scorecard_items',
    'analytics_report_saved_views',
    'analytics_report_export_jobs',
    'analytics_audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_staff_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_staff_select ON public.%I FOR SELECT TO authenticated USING (
         (SELECT public.is_god_admin_user())
         OR (SELECT public.user_is_tenant_staff(tenant_id))
       )',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_admin_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_admin_write ON public.%I FOR ALL TO authenticated USING (
         (SELECT public.is_god_admin_user())
         OR (SELECT public.user_is_tenant_admin(tenant_id))
       ) WITH CHECK (
         (SELECT public.is_god_admin_user())
         OR (SELECT public.user_is_tenant_admin(tenant_id))
       )',
      t, t
    );

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Staff may insert/update their own sessions and engagement intervals via service role APIs primarily.
-- Authenticated insert on own sessions is allowed for resilience if client SDK writes are added later.
DROP POLICY IF EXISTS analytics_user_sessions_self_insert ON public.analytics_user_sessions;
CREATE POLICY analytics_user_sessions_self_insert
  ON public.analytics_user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (SELECT public.is_god_admin_user())
      OR (SELECT public.user_is_tenant_staff(tenant_id))
    )
  );

DROP POLICY IF EXISTS analytics_user_sessions_self_update ON public.analytics_user_sessions;
CREATE POLICY analytics_user_sessions_self_update
  ON public.analytics_user_sessions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      (SELECT public.is_god_admin_user())
      OR (SELECT public.user_is_tenant_staff(tenant_id))
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (SELECT public.is_god_admin_user())
      OR (SELECT public.user_is_tenant_staff(tenant_id))
    )
  );

GRANT INSERT, UPDATE ON TABLE public.analytics_user_sessions TO authenticated;
GRANT INSERT ON TABLE public.analytics_session_engagement_intervals TO authenticated;
GRANT INSERT ON TABLE public.analytics_activity_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_report_saved_views TO authenticated;
GRANT SELECT, INSERT ON TABLE public.analytics_report_export_jobs TO authenticated;

UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[])
  || ARRAY['/api/admin/reports']::text[]
WHERE key = 'settings_reports'
  AND NOT (
    '/api/admin/reports' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );

NOTIFY pgrst, 'reload schema';
