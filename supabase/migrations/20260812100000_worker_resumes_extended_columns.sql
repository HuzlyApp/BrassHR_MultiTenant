-- Extended resume metadata used by upload-resume and async parse jobs.
ALTER TABLE public.worker_resumes
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS parse_status text,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS extracted_text text;

COMMENT ON COLUMN public.worker_resumes.storage_path IS 'Object path within worker-resumes bucket';
COMMENT ON COLUMN public.worker_resumes.file_name IS 'Original upload filename (display)';
COMMENT ON COLUMN public.worker_resumes.parse_status IS 'Mirrors parsing_status for legacy parse job updates';
COMMENT ON COLUMN public.worker_resumes.extracted_text IS 'Plain text extracted from PDF/DOCX at upload time';
