-- Optional department number/code for the catalog UI (e.g. F-01).

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS code text;

COMMENT ON COLUMN public.departments.code IS
  'Optional short department number/code shown in settings (e.g. F-01).';

CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_code_uidx
  ON public.departments (tenant_id, lower(btrim(code)))
  WHERE code IS NOT NULL AND char_length(btrim(code)) > 0;

NOTIFY pgrst, 'reload schema';
