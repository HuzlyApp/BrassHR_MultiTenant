-- Replace the obsolete wizard instructions in the platform's active welcome email.
-- Existing secure continuation links now route to Launch Pad in the application.
UPDATE public.email_templates
SET subject = 'Welcome to BrassHR — Open Your Launch Pad',
    body_html = $email$<p>Hello {{tenantAdminName}},</p>
<p>Your BrassHR workspace is ready, and your account is set up as your company's administrator.</p>
<p><strong>Sign-in email:</strong> {{tenantEmail}}</p>
<p>Use the password you chose during signup. You can continue with the same email and password when you open your company workspace.</p>
<p><a href="{{tenantOnboardingStatusLink}}" style="display:inline-block;padding:12px 20px;background-color:#012352;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open Launch Pad</a></p>
<p>Finish your company details, branding, and subdomain in Launch Pad. Once you finish setup, a confirmation will show your company's workspace address and a button to open it.</p>
<p>If you need help, contact {{supportEmail}}.</p>$email$,
    body_text = $email$Hello {{tenantAdminName}},

Your BrassHR workspace is ready, and your account is set up as your company's administrator.
Sign-in email: {{tenantEmail}}
Use the password you chose during signup.

Open Launch Pad: {{tenantOnboardingStatusLink}}

Finish your company details, branding, and subdomain in Launch Pad. Once you finish setup, a confirmation will show your company's workspace address and a button to open it. Use the same signup email and password there.

Need help? Contact {{supportEmail}}.$email$,
    updated_at = now()
WHERE tenant_id IS NULL
  AND template_key = 'tenant_onboarding_continuation'
  AND locale = 'en'
  AND status = 'active'
  AND is_active_version = true;
