-- Allow staff to open the SMB Launch Pad checklist (always-granted dashboard module).
UPDATE public.permission_resources
SET page_prefixes = coalesce(page_prefixes, ARRAY[]::text[]) || ARRAY['/admin_recruiter/launch-pad']::text[]
WHERE key = 'dashboard'
  AND NOT (
    '/admin_recruiter/launch-pad' = ANY (coalesce(page_prefixes, ARRAY[]::text[]))
  );
