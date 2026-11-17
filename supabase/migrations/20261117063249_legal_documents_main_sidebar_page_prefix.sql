-- Allow admin company settings to open the main-rail Legal Documents page.
UPDATE public.permission_resources
SET page_prefixes = coalesce(page_prefixes, ARRAY[]::text[]) || ARRAY['/admin_recruiter/legal-documents']::text[]
WHERE key = 'settings_company'
  AND NOT (
    '/admin_recruiter/legal-documents' = ANY (coalesce(page_prefixes, ARRAY[]::text[]))
  );
