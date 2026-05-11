-- One active onboarding Zoho agreement per email: block a second send while a prior
-- request is still sent/viewed/signed/completed. Declined rows are excluded so the
-- same email can start again after a decline.
--
-- If this migration fails, dedupe public.zoho_sign_requests for onboarding emails
-- that have more than one non-declined row before re-running.

create unique index if not exists zoho_sign_requests_onboarding_email_active_uq
  on public.zoho_sign_requests (lower(trim(email)), source)
  where source = 'onboarding'
    and lower(trim(coalesce(status, ''))) <> 'declined';
