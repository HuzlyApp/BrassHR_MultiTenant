-- Extended tenant branding for Settings (login/signup, typography).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS login_logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS signup_logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS signup_headline text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS signup_subheadline text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_font text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS heading_font text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS body_font text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS font_color text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS heading_color text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS muted_text_color text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS button_text text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS button_color text;

COMMENT ON COLUMN public.tenants.login_logo_url IS 'Logo shown on worker/recruiter sign-in; falls back to logo_url.';
COMMENT ON COLUMN public.tenants.signup_logo_url IS 'Logo shown on tenant signup; falls back to logo_url.';
COMMENT ON COLUMN public.tenants.signup_headline IS 'Headline on tenant signup surfaces.';
COMMENT ON COLUMN public.tenants.signup_subheadline IS 'Subheadline on tenant signup surfaces.';
COMMENT ON COLUMN public.tenants.primary_font IS 'Font id for primary UI text (inter, roboto, poppins, ubuntu, impact).';
COMMENT ON COLUMN public.tenants.heading_font IS 'Font id for headings.';
COMMENT ON COLUMN public.tenants.body_font IS 'Font id for body copy.';
COMMENT ON COLUMN public.tenants.font_color IS 'Default body text color hex.';
COMMENT ON COLUMN public.tenants.heading_color IS 'Heading text color hex.';
COMMENT ON COLUMN public.tenants.muted_text_color IS 'Muted/helper text color hex.';
COMMENT ON COLUMN public.tenants.button_text IS 'Primary auth CTA label override.';
COMMENT ON COLUMN public.tenants.button_color IS 'Primary auth CTA background hex; falls back to primary_color.';
