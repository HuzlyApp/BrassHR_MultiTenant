-- Multi-tenant email templates with versioning, global defaults, and tenant overrides.
-- Applied via Supabase MCP; keep file in repo for local `supabase db push`.

DO $$ BEGIN
  CREATE TYPE public.email_template_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  body_text text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  status public.email_template_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  is_active_version boolean NOT NULL DEFAULT false,
  source_global_template_id uuid REFERENCES public.email_templates (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT email_templates_template_key_format CHECK (
    template_key ~ '^[a-z][a-z0-9._-]{0,127}$'
  ),
  CONSTRAINT email_templates_locale_format CHECK (locale ~ '^[a-z]{2}(-[A-Za-z]{2,4})?$'),
  CONSTRAINT email_templates_version_positive CHECK (version > 0),
  CONSTRAINT email_templates_variables_is_array CHECK (jsonb_typeof(variables) = 'array')
);

COMMENT ON TABLE public.email_templates IS
  'Versioned email templates. tenant_id NULL = global default; tenants override via separate rows.';

CREATE INDEX IF NOT EXISTS email_templates_tenant_key_locale_idx
  ON public.email_templates (tenant_id, template_key, locale);

CREATE INDEX IF NOT EXISTS email_templates_global_key_locale_idx
  ON public.email_templates (template_key, locale)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_logical_version_uq
  ON public.email_templates (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_key,
    locale,
    version
  );

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_active_version_uq
  ON public.email_templates (
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_key,
    locale
  )
  WHERE is_active_version = true AND status = 'active';

CREATE OR REPLACE FUNCTION public.email_templates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_templates_set_updated_at ON public.email_templates;
CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.email_templates_set_updated_at();

CREATE OR REPLACE FUNCTION public.is_god_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.god_admin
      FROM public.users u
      WHERE u.id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_god_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_god_admin_user() TO anon, authenticated, service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_select ON public.email_templates;
CREATE POLICY email_templates_select
  ON public.email_templates
  FOR SELECT
  TO authenticated
  USING (
    public.is_god_admin_user()
    OR tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS email_templates_insert ON public.email_templates;
CREATE POLICY email_templates_insert
  ON public.email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_god_admin_user()
    OR (
      tenant_id IS NOT NULL
      AND tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS email_templates_update ON public.email_templates;
CREATE POLICY email_templates_update
  ON public.email_templates
  FOR UPDATE
  TO authenticated
  USING (
    public.is_god_admin_user()
    OR (
      tenant_id IS NOT NULL
      AND tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.is_god_admin_user()
    OR (
      tenant_id IS NOT NULL
      AND tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS email_templates_delete ON public.email_templates;
CREATE POLICY email_templates_delete
  ON public.email_templates
  FOR DELETE
  TO authenticated
  USING (
    public.is_god_admin_user()
    OR (
      tenant_id IS NOT NULL
      AND tenant_id = public.current_tenant_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL, 'welcome', 'Welcome email', 'Welcome to {{company_name}}',
  '<p>Hello {{first_name}},</p><p>Welcome to {{company_name}}.</p>',
  E'Hello {{first_name}},\n\nWelcome to {{company_name}}.',
  '[{"key":"first_name","required":true},{"key":"company_name","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'welcome' AND t.locale = 'en' AND t.version = 1
);

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL, 'application_received', 'Application received',
  'We received your application — {{company_name}}',
  '<p>Hi {{first_name}},</p><p>Thank you for applying to {{company_name}}. We will review your application and contact you soon.</p>',
  E'Hi {{first_name}},\n\nThank you for applying to {{company_name}}. We will review your application and contact you soon.',
  '[{"key":"first_name","required":true},{"key":"company_name","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'application_received' AND t.locale = 'en' AND t.version = 1
);

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL, 'password_reset', 'Password reset', 'Reset your password — {{company_name}}',
  '<p>Hi {{first_name}},</p><p>Use this link to reset your password: {{reset_link}}</p>',
  E'Hi {{first_name}},\n\nUse this link to reset your password: {{reset_link}}',
  '[{"key":"first_name","required":true},{"key":"company_name","required":true},{"key":"reset_link","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'password_reset' AND t.locale = 'en' AND t.version = 1
);
