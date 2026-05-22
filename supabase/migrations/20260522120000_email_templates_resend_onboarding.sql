-- Resend onboarding templates: sender fields + application_status / declined seeds.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS reply_to_email text;

COMMENT ON COLUMN public.email_templates.from_email IS
  'Optional tenant override for Resend From address.';
COMMENT ON COLUMN public.email_templates.reply_to_email IS
  'Optional tenant override for Reply-To address.';

-- Application status link (sent after onboarding submission)
INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'application_status',
  'Application status link',
  'View your application status — {{tenantName}}',
  '<p>Hi {{applicantName}},</p><p>Thank you for completing your application with {{tenantName}}.</p><p><a href="{{applicationStatusUrl}}">View your application status</a></p><p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Hi {{applicantName}},\n\nThank you for completing your application with {{tenantName}}.\n\nView your status: {{applicationStatusUrl}}\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"applicationStatusUrl","required":true},{"key":"supportEmail","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'application_status' AND t.locale = 'en' AND t.version = 1
);

-- Declined application
INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'declined',
  'Application declined',
  'Update on your application — {{tenantName}}',
  '<p>Hi {{applicantName}},</p><p>Thank you for your interest in {{tenantName}}. After review, we are unable to move forward with your application at this time.</p><p>{{reason}}</p><p>If you have questions, contact {{supportEmail}}.</p>',
  E'Hi {{applicantName}},\n\nThank you for your interest in {{tenantName}}. We are unable to move forward at this time.\n\n{{reason}}\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"reason","required":false},{"key":"supportEmail","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'declined' AND t.locale = 'en' AND t.version = 1
);

-- Refresh global welcome copy to onboarding variable names (idempotent content update)
UPDATE public.email_templates
SET
  name = 'Welcome email',
  subject = 'Welcome to {{tenantName}}',
  body_html = '<p>Hi {{applicantName}},</p><p>Welcome to {{tenantName}}. Your application has been accepted.</p><p><a href="{{applicationStatusUrl}}">View your application status</a></p><p>Questions? {{supportEmail}}</p>',
  body_text = E'Hi {{applicantName}},\n\nWelcome to {{tenantName}}.\n\nView status: {{applicationStatusUrl}}\n\n{{supportEmail}}',
  variables = '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"applicationStatusUrl","required":true},{"key":"supportEmail","required":true}]'::jsonb,
  updated_at = now()
WHERE tenant_id IS NULL
  AND template_key = 'welcome'
  AND locale = 'en'
  AND version = 1
  AND is_active_version = true;
