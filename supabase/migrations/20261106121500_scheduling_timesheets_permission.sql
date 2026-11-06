-- Timesheets (and related scheduling APIs) belong to the Scheduling module.
-- Without these prefixes, /admin_recruiter/timesheets is classified as unmapped
-- and returns "You don't have access to that page."

UPDATE public.permission_resources
SET
  description = 'Manage schedules, shifts, clock-ins, and timesheets.',
  page_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(page_prefixes, ARRAY[]::text[])
        || ARRAY['/admin_recruiter/timesheets']::text[]
      ) AS prefix
      ORDER BY prefix
    )
  ),
  api_prefixes = (
    SELECT ARRAY(
      SELECT DISTINCT prefix
      FROM unnest(
        coalesce(api_prefixes, ARRAY[]::text[])
        || ARRAY[
          '/api/admin/timesheets',
          '/api/admin/scheduling',
          '/api/admin/shifts'
        ]::text[]
      ) AS prefix
      ORDER BY prefix
    )
  )
WHERE key = 'scheduling';
