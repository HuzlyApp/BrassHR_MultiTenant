-- Tenant-scoped legal documents (privacy policy, terms, DPA, custom policies).
-- Admin company settings can view / update / add; public pages read published rows.

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  document_key text NOT NULL,
  title text NOT NULL,
  last_updated_label text,
  audience text NOT NULL DEFAULT 'all',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT legal_documents_key_format CHECK (
    document_key ~ '^[a-z][a-z0-9_-]{0,63}$'
  ),
  CONSTRAINT legal_documents_audience_check CHECK (
    audience IN ('all', 'tenant', 'worker', 'applicant')
  ),
  CONSTRAINT legal_documents_sections_is_array CHECK (
    jsonb_typeof(sections) = 'array'
  ),
  CONSTRAINT legal_documents_title_not_blank CHECK (
    char_length(btrim(title)) > 0
  ),
  CONSTRAINT legal_documents_tenant_key_uq UNIQUE (tenant_id, document_key)
);

COMMENT ON TABLE public.legal_documents IS
  'Tenant-scoped legal policies (privacy, terms, DPA, custom). System rows are seeded from platform defaults; admins may edit or add custom policies.';

CREATE INDEX IF NOT EXISTS legal_documents_tenant_sort_idx
  ON public.legal_documents (tenant_id, sort_order, title);

CREATE INDEX IF NOT EXISTS legal_documents_tenant_published_idx
  ON public.legal_documents (tenant_id, document_key)
  WHERE is_published = true;

CREATE OR REPLACE FUNCTION public.legal_documents_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_documents_set_updated_at ON public.legal_documents;
CREATE TRIGGER legal_documents_set_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.legal_documents_set_updated_at();

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_documents_select ON public.legal_documents;
CREATE POLICY legal_documents_select
  ON public.legal_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_god_admin_user()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS legal_documents_insert ON public.legal_documents;
CREATE POLICY legal_documents_insert
  ON public.legal_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_god_admin_user()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS legal_documents_update ON public.legal_documents;
CREATE POLICY legal_documents_update
  ON public.legal_documents
  FOR UPDATE
  TO authenticated
  USING (
    public.is_god_admin_user()
    OR tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_god_admin_user()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS legal_documents_delete ON public.legal_documents;
CREATE POLICY legal_documents_delete
  ON public.legal_documents
  FOR DELETE
  TO authenticated
  USING (
    (public.is_god_admin_user() OR tenant_id = public.current_tenant_id())
    AND is_system = false
  );

-- Published policies are readable anonymously for public legal pages / applicant flows.
DROP POLICY IF EXISTS legal_documents_select_anon_published ON public.legal_documents;
CREATE POLICY legal_documents_select_anon_published
  ON public.legal_documents
  FOR SELECT
  TO anon
  USING (is_published = true);

REVOKE ALL ON TABLE public.legal_documents FROM PUBLIC;
GRANT SELECT ON TABLE public.legal_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_documents TO authenticated;
GRANT ALL ON TABLE public.legal_documents TO service_role;

-- Gate /api/admin/legal-documents behind Company settings (admin roles only).
UPDATE public.permission_resources
SET api_prefixes = coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/legal-documents']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/api/admin/legal-documents' = ANY (coalesce(api_prefixes, ARRAY[]::text[]))
  );
