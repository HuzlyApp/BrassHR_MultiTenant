-- Clients UI/API belong to the Organization module (facilities + clients).
-- Without these prefixes, /api/admin/clients and /admin_recruiter/clients are
-- classified as unmapped and return 403 Insufficient permission.

UPDATE public.permission_resources
SET
  description = 'Manage facilities, clients, and locations.',
  page_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(page_prefixes, ARRAY[]::text[]) || ARRAY['/admin_recruiter/clients']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  ),
  api_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(api_prefixes, ARRAY[]::text[]) || ARRAY['/api/admin/clients']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  )
WHERE key = 'organization';
