-- Align resume continuation email copy with applicant status link messaging.

UPDATE public.email_templates
SET
  body_html = '<p>Hello {{applicantName}},</p>
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
  body_text = E'Hello {{applicantName}},\n\nThank you for starting your application with {{tenantName}}.\n\nWe received your resume upload successfully.\n\nPlease complete your application and finish all required onboarding steps.\n\nYou can continue your application using the secure status link below:\n\n{{statusLink}}\n\nThis link will take you back to your application so you can complete any missing steps.\n\nThank you,\n{{tenantName}} Team\n\nQuestions? {{supportEmail}}',
  variables = '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"statusLink","required":true},{"key":"applicantContinuationLink","required":false},{"key":"supportEmail","required":true},{"key":"applicationStatusUrl","required":false}]'::jsonb
WHERE tenant_id IS NULL
  AND template_key = 'resume_continuation'
  AND locale = 'en'
  AND is_active_version = true;
