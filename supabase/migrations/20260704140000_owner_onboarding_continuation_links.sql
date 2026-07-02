-- Secure owner signup / tenant onboarding continuation links.

CREATE TABLE IF NOT EXISTS public.owner_onboarding_continuation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  target_path text NOT NULL DEFAULT '/tenant-onboarding',
  reason text NOT NULL DEFAULT 'signup_continuation',
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_opened_ip inet,
  last_opened_user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT owner_onboarding_continuation_links_target_path_chk
    CHECK (target_path ~ '^/tenant-onboarding'),
  CONSTRAINT owner_onboarding_continuation_links_reason_chk
    CHECK (reason ~ '^[a-z][a-z0-9_-]{0,63}$')
);

CREATE INDEX IF NOT EXISTS owner_onboarding_continuation_links_user_created_idx
  ON public.owner_onboarding_continuation_links (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS owner_onboarding_continuation_links_email_created_idx
  ON public.owner_onboarding_continuation_links (lower(email), generated_at DESC);

CREATE INDEX IF NOT EXISTS owner_onboarding_continuation_links_expires_idx
  ON public.owner_onboarding_continuation_links (expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.owner_onboarding_continuation_links IS
  'Hashed, expiring owner signup continuation links for tenant onboarding setup.';

ALTER TABLE public.owner_onboarding_continuation_links ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.owner_onboarding_continuation_links TO service_role;

-- Platform email template for tenant onboarding continuation after signup.
INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'tenant_onboarding_continuation',
  'Tenant onboarding continuation',
  'Your BrassHR Trial Is Ready — Continue Setup',
  '<p>Hello {{tenantAdminName}},</p>
<p>Welcome to BrassHR!</p>
<p>Your trial account has been created successfully, and we are preparing your workspace so you can start setting up your organization.</p>
<p>To continue your onboarding setup, please use the secure status link below:</p>
<p><a href="{{tenantOnboardingStatusLink}}">{{tenantOnboardingStatusLink}}</a></p>
<p>This link will take you back to your BrassHR setup flow, where you can continue completing the required onboarding steps, including:</p>
<ul>
<li>Selecting your company goals</li>
<li>Adding your business information</li>
<li>Customizing your branding</li>
<li>Setting up your BrassHR domain</li>
</ul>
<p>For security, please use the link sent to this email address to continue your setup. This helps us verify that the email provided during signup is valid and belongs to the correct tenant administrator.</p>
<p style="margin:24px 0;">
  <a href="{{tenantOnboardingStatusLink}}" style="display:inline-block;padding:12px 20px;background-color:#BC8B41;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Continue BrassHR Setup</a>
</p>
<p>If you did not create this BrassHR trial account, you can ignore this email.</p>
<p>Thank you,<br>The BrassHR Team</p>
<p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Hello {{tenantAdminName}},\n\nWelcome to BrassHR!\n\nYour trial account has been created successfully.\n\nContinue setup: {{tenantOnboardingStatusLink}}\n\nIf you did not create this BrassHR trial account, you can ignore this email.\n\nThank you,\nThe BrassHR Team\n\n{{supportEmail}}',
  '[{"key":"tenantAdminName","required":true},{"key":"tenantName","required":false},{"key":"tenantOnboardingStatusLink","required":true},{"key":"tenantEmail","required":true},{"key":"supportEmail","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL
    AND t.template_key = 'tenant_onboarding_continuation'
    AND t.locale = 'en'
    AND t.version = 1
);
