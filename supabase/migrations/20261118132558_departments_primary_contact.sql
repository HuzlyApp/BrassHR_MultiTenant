-- Primary contact email/alias for routing support tickets to a department.

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS primary_contact text;

COMMENT ON COLUMN public.departments.primary_contact IS
  'Individual or email alias that receives support tickets for this department.';

NOTIFY pgrst, 'reload schema';
