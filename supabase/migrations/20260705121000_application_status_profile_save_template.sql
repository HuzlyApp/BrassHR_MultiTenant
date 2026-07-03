-- Application status link email sent after profile details are saved.

UPDATE public.email_templates
SET
  name = 'Application status link',
  subject = 'Please complete your application',
  body_html = '<p>Hi {{applicantName}},</p>
<p>Thank you for starting your application.</p>
<p>Please use the secure link below to continue and complete all required onboarding steps:</p>
<p><a href="{{statusLink}}">{{statusLink}}</a></p>
<p>This link will allow you to return to your application and continue from where you left off.</p>
<p>Please complete all necessary steps as soon as possible so our team can review your application.</p>
<p>Thank you,<br>{{tenantName}} Team</p>
<p>Questions? {{supportEmail}}</p>',
  body_text = E'Hi {{applicantName}},\n\nThank you for starting your application.\n\nPlease use the secure link below to continue and complete all required onboarding steps:\n\n{{statusLink}}\n\nThis link will allow you to return to your application and continue from where you left off.\n\nPlease complete all necessary steps as soon as possible so our team can review your application.\n\nThank you,\n{{tenantName}} Team\n\nQuestions? {{supportEmail}}',
  variables = '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"statusLink","required":true},{"key":"applicantContinuationLink","required":false},{"key":"applicationStatusUrl","required":false},{"key":"supportEmail","required":true}]'::jsonb,
  updated_at = now()
WHERE tenant_id IS NULL
  AND template_key = 'application_status'
  AND locale = 'en'
  AND is_active_version = true;
