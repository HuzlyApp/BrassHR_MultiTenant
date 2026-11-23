-- Healthcare profile fields: Primary Allied Health Role + Specialty (editable on candidate Profile).

ALTER TABLE public.worker
  ADD COLUMN IF NOT EXISTS allied_health_role text,
  ADD COLUMN IF NOT EXISTS specialty text;

COMMENT ON COLUMN public.worker.allied_health_role IS
  'Primary allied health role for healthcare-industry applicants (admin Profile).';

COMMENT ON COLUMN public.worker.specialty IS
  'Specialty for healthcare-industry applicants (admin Profile).';
