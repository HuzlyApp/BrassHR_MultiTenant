-- Approved applicant email template shown in Admin Recruiter email templates.

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'approved',
  'Applicant approved email',
  'Your application has been approved — {{tenantName}}',
  '<p>Hi {{applicantName}},</p><p>Congratulations! Your application with {{tenantName}} has been approved.</p><p>You can now sign in as an applicant to access your dashboard, view your approval status, message the tenant / recruiter, schedule appointments, and complete next steps.</p><p><a href="{{applicantPortalUrl}}">Sign in as an Applicant</a></p><p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Hi {{applicantName}},\n\nCongratulations! Your application with {{tenantName}} has been approved.\n\nSign in as an Applicant to access your dashboard, view your approval status, message the tenant / recruiter, schedule appointments, and complete next steps:\n{{applicantPortalUrl}}\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"applicantPortalUrl","required":true},{"key":"supportEmail","required":true}]'::jsonb,
  'en',
  'active',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.email_templates t
  WHERE t.tenant_id IS NULL
    AND t.template_key = 'approved'
    AND t.locale = 'en'
    AND t.version = 1
);
