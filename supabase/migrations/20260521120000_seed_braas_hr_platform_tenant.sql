-- Platform default tenant: Braas HR (branding for /, /login, applicant landing).
-- Safe to re-run (upsert on slug).

INSERT INTO public.tenants (
  name,
  slug,
  plan,
  is_active,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  welcome_headline,
  welcome_subtitle,
  auth_background_image_url,
  updated_at
)
VALUES (
  'Braas HR',
  'braas-hr',
  'platform',
  true,
  '/icons/braas-HR/BrassHR-logo.svg',
  '#BC8B41',
  '#104b83',
  '#E9B771',
  'Welcome to Braas HR',
  'HR Simplified for growing teams',
  '/images/singup-bg-image.jpg',
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  plan = EXCLUDED.plan,
  is_active = EXCLUDED.is_active,
  logo_url = EXCLUDED.logo_url,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  accent_color = EXCLUDED.accent_color,
  welcome_headline = EXCLUDED.welcome_headline,
  welcome_subtitle = EXCLUDED.welcome_subtitle,
  auth_background_image_url = EXCLUDED.auth_background_image_url,
  updated_at = now();
