-- Candidates list search: resume text, skills AND-filter, trigram/FTS indexes.
-- When both p_search and p_skills are set, matches require BOTH (AND).
-- Skills alone: every skill phrase must appear in profile skills and/or resume text (AND).
-- Free-text alone: name/email/phone/title/location/apps/resume/skills (OR across fields).

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Speed ILIKE '%…%' / similarity on contact + role fields (tenant-scoped btree indexes remain).
CREATE INDEX IF NOT EXISTS worker_first_name_trgm_idx
  ON public.worker USING gin (lower(coalesce(first_name, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_last_name_trgm_idx
  ON public.worker USING gin (lower(coalesce(last_name, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_email_trgm_idx
  ON public.worker USING gin (lower(coalesce(email, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_phone_trgm_idx
  ON public.worker USING gin (coalesce(phone, '') extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_job_role_trgm_idx
  ON public.worker USING gin (lower(coalesce(job_role, '')) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_profile_skills_name_trgm_idx
  ON public.worker_profile_skills USING gin (lower(skill_name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS worker_profile_skills_tenant_worker_idx
  ON public.worker_profile_skills (tenant_id, worker_id);

-- Partial/substring resume search + FTS for multi-word resume queries.
CREATE INDEX IF NOT EXISTS worker_resumes_extracted_text_trgm_idx
  ON public.worker_resumes USING gin (coalesce(extracted_text, '') extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS worker_resumes_extracted_text_fts_idx
  ON public.worker_resumes
  USING gin (to_tsvector('english', coalesce(extracted_text, '')))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS worker_resumes_tenant_worker_active_idx
  ON public.worker_resumes (tenant_id, worker_id)
  WHERE deleted_at IS NULL;
