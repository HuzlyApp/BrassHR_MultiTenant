-- Ensure tenant branding columns exist (fixes PostgREST: "could not find ... in the schema cache").
-- Safe to rerun: IF NOT EXISTS for each ALTER.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#0d9488';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#0f766e';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#99f6e4';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_headline text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS welcome_subtitle text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS auth_background_image_url text;

-- Ask PostgREST to pick up DDL without waiting for periodic refresh (hosted Supabase).
NOTIFY pgrst, 'reload schema';
