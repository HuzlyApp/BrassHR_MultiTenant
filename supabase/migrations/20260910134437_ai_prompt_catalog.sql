-- AI Prompt Catalog: industry catalog, AI packs, versioned prompts, tenant bindings,
-- client gates, append-only run audit. Does not publish unapproved pack bodies.
-- Production data is not modified by applying this file locally only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Catalog tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_feature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_feature_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,62}$')
);

CREATE TABLE IF NOT EXISTS public.ai_variant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_variant_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,62}$')
);

CREATE TABLE IF NOT EXISTS public.ai_vertical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'industry',
  description text,
  fallback_vertical_key text REFERENCES public.ai_vertical (key),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_vertical_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  CONSTRAINT ai_vertical_kind_check CHECK (kind = ANY (ARRAY['industry', 'delivery']))
);

CREATE TABLE IF NOT EXISTS public.industry_catalog (
  key text PRIMARY KEY,
  label text NOT NULL,
  ai_vertical_key text NOT NULL REFERENCES public.ai_vertical (key),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_user_facing boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT industry_catalog_key_format CHECK (key ~ '^[a-z][a-z0-9_]{1,62}$')
);

CREATE INDEX IF NOT EXISTS industry_catalog_vertical_idx
  ON public.industry_catalog (ai_vertical_key);

CREATE TABLE IF NOT EXISTS public.ai_prompt_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.ai_feature (id),
  variant_id uuid NOT NULL REFERENCES public.ai_variant (id),
  vertical_id uuid NOT NULL REFERENCES public.ai_vertical (id),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT ai_prompt_template_master_or_fork CHECK (tenant_id IS NULL OR tenant_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_template_master_uq
  ON public.ai_prompt_template (feature_id, variant_id, vertical_id)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_template_tenant_uq
  ON public.ai_prompt_template (tenant_id, feature_id, variant_id, vertical_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_prompt_template_tenant_idx
  ON public.ai_prompt_template (tenant_id);
CREATE INDEX IF NOT EXISTS ai_prompt_template_feature_idx
  ON public.ai_prompt_template (feature_id);
CREATE INDEX IF NOT EXISTS ai_prompt_template_variant_idx
  ON public.ai_prompt_template (variant_id);
CREATE INDEX IF NOT EXISTS ai_prompt_template_vertical_idx
  ON public.ai_prompt_template (vertical_id);

CREATE TABLE IF NOT EXISTS public.ai_prompt_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.ai_prompt_template (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  is_current boolean NOT NULL DEFAULT false,
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text NOT NULL DEFAULT '',
  response_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_reason text,
  content_hash text,
  effective_from timestamptz,
  effective_to timestamptz,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  retired_at timestamptz,
  retired_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  source_version_id uuid REFERENCES public.ai_prompt_version (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT ai_prompt_version_status_check CHECK (status = ANY (ARRAY['draft', 'published', 'retired'])),
  CONSTRAINT ai_prompt_version_number_positive CHECK (version_number > 0),
  CONSTRAINT ai_prompt_version_current_published CHECK (is_current = false OR status = 'published'),
  CONSTRAINT ai_prompt_version_schema_object CHECK (jsonb_typeof(response_schema) = 'object'),
  CONSTRAINT ai_prompt_version_model_object CHECK (jsonb_typeof(model_config) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_version_template_number_uq
  ON public.ai_prompt_version (template_id, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS ai_prompt_version_current_uq
  ON public.ai_prompt_version (template_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS ai_prompt_version_template_idx
  ON public.ai_prompt_version (template_id);
CREATE INDEX IF NOT EXISTS ai_prompt_version_status_idx
  ON public.ai_prompt_version (status);
CREATE INDEX IF NOT EXISTS ai_prompt_version_hash_idx
  ON public.ai_prompt_version (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tenant_vertical (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  vertical_id uuid NOT NULL REFERENCES public.ai_vertical (id),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, vertical_id)
);

CREATE INDEX IF NOT EXISTS tenant_vertical_tenant_idx
  ON public.tenant_vertical (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_vertical_vertical_idx
  ON public.tenant_vertical (vertical_id);

CREATE TABLE IF NOT EXISTS public.tenant_industry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  industry_key text NOT NULL REFERENCES public.industry_catalog (key),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, industry_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_industry_primary_uq
  ON public.tenant_industry (tenant_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS tenant_industry_tenant_idx
  ON public.tenant_industry (tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_ai_binding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.ai_feature (id),
  variant_id uuid NOT NULL REFERENCES public.ai_variant (id),
  vertical_id uuid NOT NULL REFERENCES public.ai_vertical (id),
  mode text NOT NULL DEFAULT 'inherited',
  is_enabled boolean NOT NULL DEFAULT true,
  pinned_version_id uuid REFERENCES public.ai_prompt_version (id) ON DELETE SET NULL,
  fork_template_id uuid REFERENCES public.ai_prompt_template (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_id, variant_id, vertical_id),
  CONSTRAINT tenant_ai_binding_mode_check CHECK (mode = ANY (ARRAY['inherited', 'pinned', 'forked', 'disabled']))
);

CREATE INDEX IF NOT EXISTS tenant_ai_binding_tenant_idx
  ON public.tenant_ai_binding (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_ai_binding_feature_idx
  ON public.tenant_ai_binding (feature_id);
CREATE INDEX IF NOT EXISTS tenant_ai_binding_variant_idx
  ON public.tenant_ai_binding (variant_id);
CREATE INDEX IF NOT EXISTS tenant_ai_binding_vertical_idx
  ON public.tenant_ai_binding (vertical_id);
CREATE INDEX IF NOT EXISTS tenant_ai_binding_pinned_idx
  ON public.tenant_ai_binding (pinned_version_id)
  WHERE pinned_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenant_ai_binding_fork_idx
  ON public.tenant_ai_binding (fork_template_id)
  WHERE fork_template_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_client_gate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  match_type text NOT NULL,
  match_value text NOT NULL,
  feature_key text NOT NULL DEFAULT 'candidate_match',
  variant_key text NOT NULL DEFAULT 'client_gate',
  vertical_key_override text REFERENCES public.ai_vertical (key),
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_client_gate_match_type_check CHECK (
    match_type = ANY (ARRAY['client_name', 'source_key', 'client_account_id'])
  ),
  CONSTRAINT ai_client_gate_match_value_not_empty CHECK (char_length(trim(match_value)) > 0)
);

CREATE INDEX IF NOT EXISTS ai_client_gate_tenant_idx
  ON public.ai_client_gate (tenant_id);
CREATE INDEX IF NOT EXISTS ai_client_gate_match_idx
  ON public.ai_client_gate (match_type, lower(match_value));
CREATE UNIQUE INDEX IF NOT EXISTS ai_client_gate_match_uq
  ON public.ai_client_gate (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    match_type,
    lower(match_value),
    feature_key,
    variant_key
  );

CREATE TABLE IF NOT EXISTS public.ai_prompt_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  variant_key text NOT NULL,
  vertical_key text,
  industry_key text,
  prompt_version_id uuid REFERENCES public.ai_prompt_version (id) ON DELETE SET NULL,
  content_hash text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  input_hash text,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  credit_cost numeric,
  status text NOT NULL,
  error_code text,
  output_reference text,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_prompt_run_status_check CHECK (
    status = ANY (ARRAY['success', 'failed', 'skipped_no_prompt', 'skipped_budget'])
  )
);

CREATE INDEX IF NOT EXISTS ai_prompt_run_tenant_created_idx
  ON public.ai_prompt_run (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_prompt_run_version_idx
  ON public.ai_prompt_run (prompt_version_id);
CREATE INDEX IF NOT EXISTS ai_prompt_run_entity_idx
  ON public.ai_prompt_run (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ai_prompt_run_feature_idx
  ON public.ai_prompt_run (feature_key, variant_key, vertical_key);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS primary_industry_key text REFERENCES public.industry_catalog (key);

CREATE INDEX IF NOT EXISTS tenants_primary_industry_idx
  ON public.tenants (primary_industry_key)
  WHERE primary_industry_key IS NOT NULL;

ALTER TABLE public.job_requisitions
  ADD COLUMN IF NOT EXISTS industry_key text REFERENCES public.industry_catalog (key);

CREATE INDEX IF NOT EXISTS job_requisitions_industry_key_idx
  ON public.job_requisitions (tenant_id, industry_key)
  WHERE industry_key IS NOT NULL;

ALTER TABLE public.job_application_analysis_versions
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES public.ai_prompt_version (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_content_hash text;

CREATE INDEX IF NOT EXISTS job_application_analysis_versions_prompt_idx
  ON public.job_application_analysis_versions (prompt_version_id)
  WHERE prompt_version_id IS NOT NULL;

COMMENT ON COLUMN public.job_requisitions.industry_key IS
  'User-facing industry key. Derived AI pack is resolved centrally and is never user-entered.';
COMMENT ON COLUMN public.tenants.primary_industry_key IS
  'Primary hire-for industry key. Distinct from staffing/business type.';
COMMENT ON TABLE public.ai_prompt_run IS
  'Append-only AI prompt execution audit. Do not store raw résumés.';

-- ---------------------------------------------------------------------------
-- Seed features, variants, AI packs, industry catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.ai_feature (key, name, description) VALUES
  ('candidate_match', 'Candidate Match', 'Résumé-to-job matching analysis'),
  ('job_description', 'Job Description', 'Job description generation'),
  ('resume_refine', 'Resume Refine', 'Résumé refinement'),
  ('rate_strategy', 'Rate Strategy', 'Bill/pay rate strategy'),
  ('content_draft', 'Content Draft', 'General recruiting content drafts')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.ai_variant (key, name, description) VALUES
  ('default', 'Default', 'Standard Candidate Match analysis'),
  ('deep', 'Deep', 'Deeper Candidate Match analysis'),
  ('client_gate', 'Client Gate', 'Stricter client-specific matching')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.ai_vertical (key, name, kind, fallback_vertical_key) VALUES
  ('global', 'Global', 'industry', NULL),
  ('technology', 'Technology', 'industry', 'global'),
  ('healthcare', 'Healthcare', 'industry', 'global'),
  ('home_care', 'Home Care', 'industry', 'global'),
  ('hospitality', 'Hospitality', 'industry', 'global'),
  ('childcare', 'Childcare', 'industry', 'global'),
  ('warehouse', 'Warehouse', 'industry', 'global'),
  ('staffing', 'Staffing', 'delivery', NULL),
  ('msp', 'MSP', 'delivery', NULL)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  fallback_vertical_key = EXCLUDED.fallback_vertical_key;

INSERT INTO public.industry_catalog (key, label, ai_vertical_key, sort_order, is_user_facing) VALUES
  ('healthcare', 'Healthcare', 'healthcare', 10, true),
  ('home_care', 'Home Care / Home Health', 'home_care', 20, true),
  ('allied_health', 'Allied Health', 'healthcare', 30, true),
  ('senior_care', 'Senior Care / Assisted Living', 'healthcare', 40, true),
  ('hospitality', 'Hospitality / Food Service', 'hospitality', 50, true),
  ('retail', 'Retail & Convenience Stores', 'hospitality', 60, true),
  ('technology', 'Technology / IT Services', 'technology', 70, true),
  ('trades', 'Construction & Trades', 'global', 80, true),
  ('cleaning', 'Cleaning & Janitorial Services', 'warehouse', 90, true),
  ('childcare', 'Education / Childcare / Daycare', 'childcare', 100, true),
  ('nonprofit', 'Nonprofit / Community Organizations', 'global', 110, true),
  ('warehouse', 'Manufacturing / Warehouse / Distribution', 'warehouse', 120, true),
  ('transportation', 'Transportation & Logistics', 'warehouse', 130, true),
  ('professional', 'Professional Services', 'global', 140, true),
  ('beauty', 'Beauty / Salon / Spa', 'global', 150, true),
  ('fitness', 'Fitness / Wellness / Gyms', 'hospitality', 160, true),
  ('other', 'Other', 'global', 170, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  ai_vertical_key = EXCLUDED.ai_vertical_key,
  sort_order = EXCLUDED.sort_order,
  is_user_facing = EXCLUDED.is_user_facing;

-- Randstad is a client gate, not an industry.
INSERT INTO public.ai_client_gate (
  tenant_id, match_type, match_value, feature_key, variant_key, vertical_key_override, is_active, priority
) VALUES
  (NULL, 'client_name', 'randstad', 'candidate_match', 'client_gate', NULL, true, 200),
  (NULL, 'source_key', 'randstad', 'candidate_match', 'client_gate', NULL, true, 190)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.map_industry_to_ai_vertical(p_industry_key text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.ai_vertical_key
  FROM public.industry_catalog c
  WHERE c.key = p_industry_key
    AND c.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ai_prompt_content_hash(
  p_system_prompt text,
  p_user_prompt_template text,
  p_response_schema jsonb,
  p_model_config jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(
    digest(
      convert_to(
        concat_ws(
          chr(30),
          coalesce(p_system_prompt, ''),
          coalesce(p_user_prompt_template, ''),
          coalesce(p_response_schema::text, '{}'),
          coalesce(p_model_config::text, '{}')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.publish_ai_prompt_version(
  p_version_id uuid,
  p_change_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_status text;
  v_hash text;
  v_system text;
  v_user text;
  v_schema jsonb;
  v_model jsonb;
  v_role text;
BEGIN
  v_role := coalesce(nullif(current_setting('role', true), 'none'), current_user);
  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT public.is_god_admin_user() THEN
    RAISE EXCEPTION 'Only Operations/Admin users may publish AI prompts';
  END IF;

  IF p_change_reason IS NULL OR length(trim(p_change_reason)) = 0 THEN
    RAISE EXCEPTION 'Publishing requires a non-empty change_reason';
  END IF;

  SELECT template_id, status, system_prompt, user_prompt_template, response_schema, model_config
    INTO v_template_id, v_status, v_system, v_user, v_schema, v_model
  FROM public.ai_prompt_version
  WHERE id = p_version_id
  FOR UPDATE;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Prompt version not found';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft versions can be published';
  END IF;

  IF length(trim(v_system)) = 0 THEN
    RAISE EXCEPTION 'system_prompt cannot be empty';
  END IF;

  v_hash := public.ai_prompt_content_hash(v_system, v_user, v_schema, v_model);

  UPDATE public.ai_prompt_version
  SET is_current = false,
      updated_at = now()
  WHERE template_id = v_template_id
    AND is_current = true
    AND id <> p_version_id;

  UPDATE public.ai_prompt_version
  SET status = 'published',
      is_current = true,
      change_reason = trim(p_change_reason),
      content_hash = v_hash,
      published_at = now(),
      published_by = auth.uid(),
      effective_from = coalesce(effective_from, now()),
      updated_at = now()
  WHERE id = p_version_id;

  RETURN p_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_ai_prompt_version(p_version_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_role text;
BEGIN
  v_role := coalesce(nullif(current_setting('role', true), 'none'), current_user);
  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT public.is_god_admin_user() THEN
    RAISE EXCEPTION 'Only Operations/Admin users may retire AI prompts';
  END IF;

  SELECT status INTO v_status
  FROM public.ai_prompt_version
  WHERE id = p_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Prompt version not found';
  END IF;
  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'Only published versions can be retired';
  END IF;

  UPDATE public.ai_prompt_version
  SET status = 'retired',
      is_current = false,
      retired_at = now(),
      retired_by = auth.uid(),
      effective_to = coalesce(effective_to, now()),
      updated_at = now()
  WHERE id = p_version_id;

  RETURN p_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_tenant_ai_industries(
  p_tenant_id uuid,
  p_industry_keys text[],
  p_primary_industry_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_primary text;
  v_vertical_key text;
  v_feature_id uuid;
  v_variant record;
  v_vertical_id uuid;
  v_role text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant id is required';
  END IF;

  v_role := coalesce(nullif(current_setting('role', true), 'none'), current_user);
  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT public.is_god_admin_user()
     AND NOT public.user_is_tenant_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'Not authorized to bind tenant AI industries';
  END IF;

  v_primary := nullif(trim(coalesce(p_primary_industry_key, '')), '');

  FOREACH v_key IN ARRAY coalesce(p_industry_keys, ARRAY[]::text[]) LOOP
    v_key := trim(v_key);
    IF v_key IS NULL OR v_key = '' THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.industry_catalog c WHERE c.key = v_key AND c.is_active) THEN
      RAISE EXCEPTION 'Unsupported industry key: %', v_key;
    END IF;
  END LOOP;

  IF v_primary IS NOT NULL AND NOT (v_primary = ANY (p_industry_keys)) THEN
    p_industry_keys := array_prepend(v_primary, p_industry_keys);
  END IF;

  DELETE FROM public.tenant_industry ti
  WHERE ti.tenant_id = p_tenant_id
    AND NOT (ti.industry_key = ANY (p_industry_keys));

  UPDATE public.tenant_industry
  SET is_primary = false
  WHERE tenant_id = p_tenant_id;

  FOREACH v_key IN ARRAY coalesce(p_industry_keys, ARRAY[]::text[]) LOOP
    v_key := trim(v_key);
    IF v_key IS NULL OR v_key = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.tenant_industry (tenant_id, industry_key, is_primary)
    VALUES (p_tenant_id, v_key, v_primary IS NOT NULL AND v_key = v_primary)
    ON CONFLICT (tenant_id, industry_key) DO UPDATE
      SET is_primary = EXCLUDED.is_primary;
  END LOOP;

  IF v_primary IS NOT NULL THEN
    UPDATE public.tenants
    SET primary_industry_key = v_primary
    WHERE id = p_tenant_id;
  END IF;

  DELETE FROM public.tenant_vertical tv
  WHERE tv.tenant_id = p_tenant_id
    AND tv.vertical_id NOT IN (
      SELECT v.id
      FROM public.industry_catalog c
      JOIN public.ai_vertical v ON v.key = c.ai_vertical_key
      WHERE c.key = ANY (p_industry_keys)
    );

  INSERT INTO public.tenant_vertical (tenant_id, vertical_id, is_enabled)
  SELECT DISTINCT p_tenant_id, v.id, true
  FROM public.industry_catalog c
  JOIN public.ai_vertical v ON v.key = c.ai_vertical_key
  WHERE c.key = ANY (p_industry_keys)
  ON CONFLICT (tenant_id, vertical_id) DO NOTHING;

  SELECT id INTO v_feature_id FROM public.ai_feature WHERE key = 'candidate_match';

  FOR v_vertical_key IN
    SELECT DISTINCT c.ai_vertical_key
    FROM public.industry_catalog c
    WHERE c.key = ANY (p_industry_keys)
  LOOP
    SELECT id INTO v_vertical_id FROM public.ai_vertical WHERE key = v_vertical_key;
    FOR v_variant IN SELECT id FROM public.ai_variant LOOP
      INSERT INTO public.tenant_ai_binding (
        tenant_id, feature_id, variant_id, vertical_id, mode, is_enabled
      ) VALUES (
        p_tenant_id, v_feature_id, v_variant.id, v_vertical_id, 'inherited', true
      )
      ON CONFLICT (tenant_id, feature_id, variant_id, vertical_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_ai_prompt_version(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retire_ai_prompt_version(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bind_tenant_ai_industries(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.map_industry_to_ai_vertical(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_prompt_content_hash(text, text, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_ai_prompt_version(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retire_ai_prompt_version(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bind_tenant_ai_industries(uuid, text[], text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Immutability triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_prompt_version_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'Published and retired prompt versions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('published', 'retired') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.system_prompt IS DISTINCT FROM OLD.system_prompt
       OR NEW.user_prompt_template IS DISTINCT FROM OLD.user_prompt_template
       OR NEW.response_schema IS DISTINCT FROM OLD.response_schema
       OR NEW.model_config IS DISTINCT FROM OLD.model_config
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.version_number IS DISTINCT FROM OLD.version_number THEN
      IF NOT (
        (OLD.status = 'published' AND NEW.status = 'retired' AND NEW.system_prompt = OLD.system_prompt)
        OR (OLD.is_current = true AND NEW.is_current = false AND NEW.system_prompt = OLD.system_prompt
            AND NEW.user_prompt_template = OLD.user_prompt_template
            AND NEW.response_schema = OLD.response_schema
            AND NEW.model_config = OLD.model_config)
      ) THEN
        RAISE EXCEPTION 'Published and retired prompt versions are immutable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_prompt_version_guard ON public.ai_prompt_version;
CREATE TRIGGER ai_prompt_version_guard
  BEFORE UPDATE OR DELETE ON public.ai_prompt_version
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_prompt_version_guard();

CREATE OR REPLACE FUNCTION public.ai_prompt_run_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'ai_prompt_run is append-only';
END;
$$;

DROP TRIGGER IF EXISTS ai_prompt_run_no_update ON public.ai_prompt_run;
CREATE TRIGGER ai_prompt_run_no_update
  BEFORE UPDATE OR DELETE ON public.ai_prompt_run
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_prompt_run_append_only();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_feature ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_vertical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_vertical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_industry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_ai_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_client_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_feature_select ON public.ai_feature;
CREATE POLICY ai_feature_select ON public.ai_feature
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_feature_write ON public.ai_feature;
CREATE POLICY ai_feature_write ON public.ai_feature
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_variant_select ON public.ai_variant;
CREATE POLICY ai_variant_select ON public.ai_variant
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_variant_write ON public.ai_variant;
CREATE POLICY ai_variant_write ON public.ai_variant
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_vertical_select ON public.ai_vertical;
CREATE POLICY ai_vertical_select ON public.ai_vertical
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_vertical_write ON public.ai_vertical;
CREATE POLICY ai_vertical_write ON public.ai_vertical
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS industry_catalog_select ON public.industry_catalog;
CREATE POLICY industry_catalog_select ON public.industry_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS industry_catalog_write ON public.industry_catalog;
CREATE POLICY industry_catalog_write ON public.industry_catalog
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_prompt_template_select ON public.ai_prompt_template;
CREATE POLICY ai_prompt_template_select ON public.ai_prompt_template
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id IS NULL
    OR tenant_id = (SELECT public.current_tenant_id())
  );

DROP POLICY IF EXISTS ai_prompt_template_write ON public.ai_prompt_template;
CREATE POLICY ai_prompt_template_write ON public.ai_prompt_template
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_prompt_version_select ON public.ai_prompt_version;
CREATE POLICY ai_prompt_version_select ON public.ai_prompt_version
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR EXISTS (
      SELECT 1
      FROM public.ai_prompt_template t
      WHERE t.id = template_id
        AND (t.tenant_id IS NULL OR t.tenant_id = (SELECT public.current_tenant_id()))
    )
  );

DROP POLICY IF EXISTS ai_prompt_version_write ON public.ai_prompt_version;
CREATE POLICY ai_prompt_version_write ON public.ai_prompt_version
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS tenant_vertical_select ON public.tenant_vertical;
CREATE POLICY tenant_vertical_select ON public.tenant_vertical
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
  );

DROP POLICY IF EXISTS tenant_vertical_write ON public.tenant_vertical;
CREATE POLICY tenant_vertical_write ON public.tenant_vertical
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS tenant_industry_select ON public.tenant_industry;
CREATE POLICY tenant_industry_select ON public.tenant_industry
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
  );

DROP POLICY IF EXISTS tenant_industry_admin_write ON public.tenant_industry;
CREATE POLICY tenant_industry_admin_write ON public.tenant_industry
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_admin(tenant_id)
  )
  WITH CHECK (
    (SELECT public.is_god_admin_user())
    OR public.user_is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS tenant_ai_binding_select ON public.tenant_ai_binding;
CREATE POLICY tenant_ai_binding_select ON public.tenant_ai_binding
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
  );

DROP POLICY IF EXISTS tenant_ai_binding_write ON public.tenant_ai_binding;
CREATE POLICY tenant_ai_binding_write ON public.tenant_ai_binding
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_client_gate_select ON public.ai_client_gate;
CREATE POLICY ai_client_gate_select ON public.ai_client_gate
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id IS NULL
    OR tenant_id = (SELECT public.current_tenant_id())
  );

DROP POLICY IF EXISTS ai_client_gate_write ON public.ai_client_gate;
CREATE POLICY ai_client_gate_write ON public.ai_client_gate
  FOR ALL TO authenticated
  USING ((SELECT public.is_god_admin_user()))
  WITH CHECK ((SELECT public.is_god_admin_user()));

DROP POLICY IF EXISTS ai_prompt_run_select ON public.ai_prompt_run;
CREATE POLICY ai_prompt_run_select ON public.ai_prompt_run
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
  );

GRANT SELECT ON public.ai_feature, public.ai_variant, public.ai_vertical, public.industry_catalog
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feature, public.ai_variant, public.ai_vertical, public.industry_catalog
  TO service_role;

GRANT SELECT ON public.ai_prompt_template, public.ai_prompt_version, public.tenant_vertical,
  public.tenant_industry, public.tenant_ai_binding, public.ai_client_gate, public.ai_prompt_run
  TO authenticated;
GRANT ALL ON public.ai_prompt_template, public.ai_prompt_version, public.tenant_vertical,
  public.tenant_industry, public.tenant_ai_binding, public.ai_client_gate, public.ai_prompt_run
  TO service_role;

GRANT INSERT, UPDATE, DELETE ON public.tenant_industry TO authenticated;

-- ---------------------------------------------------------------------------
-- Master templates (no unapproved pack bodies published)
-- ---------------------------------------------------------------------------

INSERT INTO public.ai_prompt_template (tenant_id, feature_id, variant_id, vertical_id, name)
SELECT NULL, f.id, v.id, y.id, initcap(replace(y.key, '_', ' ')) || ' ' || initcap(replace(v.key, '_', ' ')) || ' Candidate Match'
FROM public.ai_feature f
CROSS JOIN public.ai_variant v
CROSS JOIN public.ai_vertical y
WHERE f.key = 'candidate_match'
  AND y.kind = 'industry'
  AND NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_template t
    WHERE t.tenant_id IS NULL
      AND t.feature_id = f.id
      AND t.variant_id = v.id
      AND t.vertical_id = y.id
  );

CREATE OR REPLACE VIEW public.ai_current_prompt_version
WITH (security_invoker = true) AS
SELECT
  pv.id,
  pv.template_id,
  pv.version_number,
  pv.status,
  pv.is_current,
  pv.system_prompt,
  pv.user_prompt_template,
  pv.response_schema,
  pv.model_config,
  pv.change_reason,
  pv.content_hash,
  pv.effective_from,
  pv.effective_to,
  pv.published_at,
  t.tenant_id,
  f.key AS feature_key,
  v.key AS variant_key,
  y.key AS vertical_key
FROM public.ai_prompt_version pv
JOIN public.ai_prompt_template t ON t.id = pv.template_id
JOIN public.ai_feature f ON f.id = t.feature_id
JOIN public.ai_variant v ON v.id = t.variant_id
JOIN public.ai_vertical y ON y.id = t.vertical_id
WHERE pv.status = 'published'
  AND pv.is_current = true;

GRANT SELECT ON public.ai_current_prompt_version TO authenticated, service_role;

-- Legacy tenant industry backfill (labels only; Staffing & Recruiting is not a job industry).
UPDATE public.tenants t
SET primary_industry_key = c.key
FROM public.industry_catalog c
WHERE t.primary_industry_key IS NULL
  AND t.industry IS NOT NULL
  AND lower(t.industry) = lower(c.label);

INSERT INTO public.tenant_industry (tenant_id, industry_key, is_primary)
SELECT t.id, t.primary_industry_key, true
FROM public.tenants t
WHERE t.primary_industry_key IS NOT NULL
ON CONFLICT (tenant_id, industry_key) DO NOTHING;
