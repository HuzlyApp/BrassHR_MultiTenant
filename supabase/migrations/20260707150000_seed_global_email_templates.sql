-- Re-seed global email templates when the table is empty (idempotent).

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

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'application_status',
  'Application status link',
  'Please complete your application',
  '<p>Hi {{applicantName}},</p>
<p>Thank you for starting your application.</p>
<p>Please use the secure link below to continue and complete all required onboarding steps:</p>
<p><a href="{{statusLink}}">{{statusLink}}</a></p>
<p>This link will allow you to return to your application and continue from where you left off.</p>
<p>Please complete all necessary steps as soon as possible so our team can review your application.</p>
<p>Thank you,<br>{{tenantName}} Team</p>
<p>Questions? {{supportEmail}}</p>',
  E'Hi {{applicantName}},\n\nThank you for starting your application.\n\nPlease use the secure link below to continue and complete all required onboarding steps:\n\n{{statusLink}}\n\nThis link will allow you to return to your application and continue from where you left off.\n\nPlease complete all necessary steps as soon as possible so our team can review your application.\n\nThank you,\n{{tenantName}} Team\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"statusLink","required":true},{"key":"applicantContinuationLink","required":false},{"key":"applicationStatusUrl","required":false},{"key":"supportEmail","required":true}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'application_status' AND t.locale = 'en' AND t.version = 1
);

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'resume_continuation',
  'Resume upload continuation',
  'Complete Your Application',
  '<p>Hello {{applicantName}},</p>
<p>Thank you for starting your application with {{tenantName}}.</p>
<p>We received your resume upload successfully.</p>
<p>Please complete your application and finish all required onboarding steps.</p>
<p>You can continue your application using the secure status link below:</p>
<p><a href="{{statusLink}}">{{statusLink}}</a></p>
<p>This link will take you back to your application so you can complete any missing steps.</p>
<p style="margin:24px 0;">
  <a href="{{statusLink}}" style="display:inline-block;padding:12px 20px;background-color:#0D9488;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Continue Application</a>
</p>
<p>If you already completed all required steps, you may disregard this message.</p>
<p>Thank you,<br>{{tenantName}} Team</p>
<p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Hello {{applicantName}},\n\nThank you for starting your application with {{tenantName}}.\n\nWe received your resume upload successfully.\n\nPlease complete your application and finish all required onboarding steps.\n\nYou can continue your application using the secure status link below:\n\n{{statusLink}}\n\nThis link will take you back to your application so you can complete any missing steps.\n\nThank you,\n{{tenantName}} Team\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"statusLink","required":true},{"key":"applicantContinuationLink","required":false},{"key":"supportEmail","required":true},{"key":"applicationStatusUrl","required":false}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'resume_continuation' AND t.locale = 'en' AND t.version = 1
);

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
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL AND t.template_key = 'approved' AND t.locale = 'en' AND t.version = 1
);

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject, body_html, body_text, variables,
  locale, status, version, is_active_version
)
SELECT
  NULL,
  'welcome',
  'Welcome email',
  'Welcome to {{tenantName}}',
  '<p>Hi {{applicantName}},</p><p>Welcome to {{tenantName}}. Your application has been accepted.</p><p><a href="{{applicationStatusUrl}}">View your application status</a></p><p>Questions? {{supportEmail}}</p>',
  E'Hi {{applicantName}},\n\nWelcome to {{tenantName}}.\n\nView status: {{applicationStatusUrl}}\n\n{{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"applicationStatusUrl","required":true},{"key":"supportEmail","required":true}]'::jsonb,
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
