-- Dedicated tenant favicon, separate from the company logo.
-- Shown in the browser tab, admin sidebar top-left, header dropdown, and
-- the worker/applicant portal. Falls back to logo_url when unset.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS favicon_url text;

COMMENT ON COLUMN public.tenants.favicon_url IS 'Favicon shown in the browser tab, admin sidebar/header, and applicant portal; falls back to logo_url.';
