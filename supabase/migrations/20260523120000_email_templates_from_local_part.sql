-- Store editable Resend From local-part only; domain comes from RESEND_FROM_DOMAIN env.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS from_email_local_part text NOT NULL DEFAULT 'notifications';

COMMENT ON COLUMN public.email_templates.from_email_local_part IS
  'Local part of From address (before @). Domain is RESEND_FROM_DOMAIN at send time.';

-- Backfill from legacy full from_email column when present.
UPDATE public.email_templates
SET from_email_local_part = lower(
  trim(
    CASE
      WHEN from_email ~ '<[^>]+@[^>]+>' THEN
        regexp_replace(from_email, '^.*<([^>]+)>.*$', '\1')
      ELSE from_email
    END
  )
)
WHERE from_email IS NOT NULL
  AND position('@' in from_email) > 0
  AND from_email_local_part = 'notifications';

UPDATE public.email_templates
SET from_email_local_part = lower(split_part(
  CASE
    WHEN from_email ~ '<' THEN regexp_replace(from_email, '^.*<([^>]+)>.*$', '\1')
    ELSE from_email
  END,
  '@',
  1
))
WHERE from_email IS NOT NULL
  AND position('@' in coalesce(from_email, '')) > 0;

ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_from_local_part_format;
ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_from_local_part_format CHECK (
  from_email_local_part ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$'
  OR from_email_local_part ~ '^[a-z0-9]$'
);
