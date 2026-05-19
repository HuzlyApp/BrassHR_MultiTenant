-- Tenant vanity subdomains (*.ROOT_DOMAIN); nullable for legacy rows.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subdomain text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS domain text;

COMMENT ON COLUMN public.tenants.subdomain IS 'Single DNS label under ROOT_DOMAIN (e.g. clinic1 → clinic1.nexusmedpro.com).';
COMMENT ON COLUMN public.tenants.domain IS 'Full hostname served for this tenant (subdomain.ROOT_DOMAIN).';

CREATE UNIQUE INDEX IF NOT EXISTS tenants_subdomain_lower_unique
  ON public.tenants (lower(subdomain))
  WHERE subdomain IS NOT NULL AND length(trim(subdomain)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_domain_lower_unique
  ON public.tenants (lower(domain))
  WHERE domain IS NOT NULL AND length(trim(domain)) > 0;
