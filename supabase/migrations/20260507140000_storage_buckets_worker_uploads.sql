-- Private buckets expected by onboarding + admin recruiter storage scans.
-- See lib/supabase-storage-buckets.ts and app/api/admin/worker-profile/route.ts.

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES
  ('worker-resumes', 'worker-resumes', false, false),
  ('worker_required_files', 'worker_required_files', false, false),
  ('worker-onboarding', 'worker-onboarding', false, false),
  ('docs', 'docs', false, false)
ON CONFLICT (id) DO NOTHING;
