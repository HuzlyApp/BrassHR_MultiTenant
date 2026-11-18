-- Tenant-scoped inbound Integration API keys (hashed at rest).
-- Management is via staff admin APIs using the service role; Data API roles cannot read hashes.

CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['inbound']::text[],
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  last_used_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_api_keys_name_check CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  CONSTRAINT tenant_api_keys_prefix_check CHECK (char_length(key_prefix) BETWEEN 8 AND 32),
  CONSTRAINT tenant_api_keys_hash_check CHECK (char_length(key_hash) = 64),
  CONSTRAINT tenant_api_keys_scopes_check CHECK (cardinality(scopes) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_keys_key_hash_uidx
  ON public.tenant_api_keys (key_hash);

CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_active_idx
  ON public.tenant_api_keys (tenant_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_prefix_idx
  ON public.tenant_api_keys (tenant_id, key_prefix);

COMMENT ON TABLE public.tenant_api_keys IS
  'Per-tenant inbound Integration API keys. Only key_hash is stored; plaintext shown once at creation.';

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_api_keys FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tenant_api_keys TO service_role;
