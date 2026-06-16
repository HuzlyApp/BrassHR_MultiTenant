-- Firma.dev e-signature recruiting templates (Template Builder)

DO $$ BEGIN
  CREATE TYPE public.recruiter_template_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recruiter_template_category AS ENUM (
    'offer_letter',
    'nda',
    'contractor_agreement',
    'interview_consent',
    'background_check_authorization'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.recruiter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  firma_template_id uuid,
  name text NOT NULL,
  description text,
  category public.recruiter_template_category NOT NULL,
  status public.recruiter_template_status NOT NULL DEFAULT 'draft',
  document_file_name text,
  document_storage_path text,
  expiration_hours integer NOT NULL DEFAULT 168,
  firma_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_templates_name_not_empty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT recruiter_templates_expiration_positive CHECK (expiration_hours > 0)
);

CREATE INDEX IF NOT EXISTS recruiter_templates_tenant_status_idx
  ON public.recruiter_templates (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS recruiter_templates_tenant_category_idx
  ON public.recruiter_templates (tenant_id, category);

CREATE TABLE IF NOT EXISTS public.recruiter_template_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recruiter_templates (id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL,
  designation text NOT NULL DEFAULT 'Signer',
  signing_order integer NOT NULL,
  firma_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_template_roles_role_key_format CHECK (
    role_key ~ '^[a-z][a-z0-9_]{0,63}$'
  ),
  CONSTRAINT recruiter_template_roles_designation_chk CHECK (
    designation IN ('Signer', 'Approver', 'CC')
  ),
  CONSTRAINT recruiter_template_roles_unique_order UNIQUE (template_id, signing_order),
  CONSTRAINT recruiter_template_roles_unique_key UNIQUE (template_id, role_key)
);

CREATE INDEX IF NOT EXISTS recruiter_template_roles_template_idx
  ON public.recruiter_template_roles (template_id, signing_order);

CREATE TABLE IF NOT EXISTS public.recruiter_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.recruiter_templates (id) ON DELETE CASCADE,
  variable_name text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  app_data_source text NOT NULL,
  assigned_role_key text,
  firma_field_id uuid,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_template_fields_variable_format CHECK (
    variable_name ~ '^[a-z][a-z0-9_]{0,127}$'
  ),
  CONSTRAINT recruiter_template_fields_unique_var UNIQUE (template_id, variable_name)
);

CREATE INDEX IF NOT EXISTS recruiter_template_fields_template_idx
  ON public.recruiter_template_fields (template_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_recruiter_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recruiter_templates_updated_at ON public.recruiter_templates;
CREATE TRIGGER trg_recruiter_templates_updated_at
BEFORE UPDATE ON public.recruiter_templates
FOR EACH ROW
EXECUTE FUNCTION public.set_recruiter_templates_updated_at();

DROP TRIGGER IF EXISTS trg_recruiter_template_roles_updated_at ON public.recruiter_template_roles;
CREATE TRIGGER trg_recruiter_template_roles_updated_at
BEFORE UPDATE ON public.recruiter_template_roles
FOR EACH ROW
EXECUTE FUNCTION public.set_recruiter_templates_updated_at();

DROP TRIGGER IF EXISTS trg_recruiter_template_fields_updated_at ON public.recruiter_template_fields;
CREATE TRIGGER trg_recruiter_template_fields_updated_at
BEFORE UPDATE ON public.recruiter_template_fields
FOR EACH ROW
EXECUTE FUNCTION public.set_recruiter_templates_updated_at();

ALTER TABLE public.recruiter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_template_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_template_fields ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_template_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_template_fields TO authenticated;
GRANT ALL ON public.recruiter_templates TO service_role;
GRANT ALL ON public.recruiter_template_roles TO service_role;
GRANT ALL ON public.recruiter_template_fields TO service_role;

DROP POLICY IF EXISTS recruiter_templates_staff ON public.recruiter_templates;
CREATE POLICY recruiter_templates_staff
  ON public.recruiter_templates FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS recruiter_template_roles_staff ON public.recruiter_template_roles;
CREATE POLICY recruiter_template_roles_staff
  ON public.recruiter_template_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recruiter_templates rt
      WHERE rt.id = recruiter_template_roles.template_id
        AND public.user_is_tenant_staff(rt.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.recruiter_templates rt
      WHERE rt.id = recruiter_template_roles.template_id
        AND public.user_is_tenant_staff(rt.tenant_id)
    )
  );

DROP POLICY IF EXISTS recruiter_template_fields_staff ON public.recruiter_template_fields;
CREATE POLICY recruiter_template_fields_staff
  ON public.recruiter_template_fields FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.recruiter_templates rt
      WHERE rt.id = recruiter_template_fields.template_id
        AND public.user_is_tenant_staff(rt.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.recruiter_templates rt
      WHERE rt.id = recruiter_template_fields.template_id
        AND public.user_is_tenant_staff(rt.tenant_id)
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recruiter-template-documents',
  'recruiter-template-documents',
  false,
  20971520,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS recruiter_template_documents_staff_select ON storage.objects;
CREATE POLICY recruiter_template_documents_staff_select
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'recruiter-template-documents'
  AND public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS recruiter_template_documents_staff_insert ON storage.objects;
CREATE POLICY recruiter_template_documents_staff_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recruiter-template-documents'
  AND public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS recruiter_template_documents_staff_update ON storage.objects;
CREATE POLICY recruiter_template_documents_staff_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recruiter-template-documents'
  AND public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS recruiter_template_documents_staff_delete ON storage.objects;
CREATE POLICY recruiter_template_documents_staff_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recruiter-template-documents'
  AND public.user_is_tenant_staff(((storage.foldername(name))[1])::uuid)
);
