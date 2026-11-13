-- Track who added a profession document field so recruiters can only remove
-- rows they created, while still deleting uploaded files on any field.

ALTER TABLE public.tenant_profession_documents
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

COMMENT ON COLUMN public.tenant_profession_documents.created_by IS
  'Auth user who created this profession document field. Null = legacy/admin-owned.';
