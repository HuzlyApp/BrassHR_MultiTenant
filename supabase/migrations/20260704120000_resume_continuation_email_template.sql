-- Resume upload continuation email (sent after successful resume upload during onboarding).

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
<p>Thank you for starting your application.</p>
<p>We received your resume upload successfully. Your application is not fully complete yet, and there are still required steps that must be finished before your submission can be reviewed.</p>
<p>Please complete your application and finish all necessary steps using the application status link below:</p>
<p><a href="{{applicantContinuationLink}}">{{applicantContinuationLink}}</a></p>
<p>This status link will allow you to continue your application from where you left off. You can use it to return to your onboarding page, review your progress, upload any required documents, complete pending forms, and finish any remaining steps.</p>
<p>For the best experience, please complete all required onboarding steps as soon as possible. Incomplete applications may delay review, approval, or next steps in the hiring/onboarding process.</p>
<p style="margin:24px 0;">
  <a href="{{applicantContinuationLink}}" style="display:inline-block;padding:12px 20px;background-color:#0D9488;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Continue Application</a>
</p>
<p>If you already completed all required steps, you may disregard this message.</p>
<p>Thank you,<br>{{tenantName}} Team</p>
<p>Questions? Contact us at {{supportEmail}}.</p>',
  E'Hello {{applicantName}},\n\nThank you for starting your application.\n\nWe received your resume upload successfully. Your application is not fully complete yet, and there are still required steps that must be finished before your submission can be reviewed.\n\nPlease complete your application using the link below:\n\n{{applicantContinuationLink}}\n\nThis status link will allow you to continue your application from where you left off.\n\nIf you already completed all required steps, you may disregard this message.\n\nThank you,\n{{tenantName}} Team\n\nQuestions? {{supportEmail}}',
  '[{"key":"applicantName","required":true},{"key":"tenantName","required":true},{"key":"applicantContinuationLink","required":true},{"key":"supportEmail","required":true},{"key":"applicationStatusUrl","required":false}]'::jsonb,
  'en', 'active', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates t
  WHERE t.tenant_id IS NULL
    AND t.template_key = 'resume_continuation'
    AND t.locale = 'en'
    AND t.version = 1
);
