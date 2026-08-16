-- Backfill job_application_id on resumes uploaded before worker portal job linking.

UPDATE public.worker_resumes wr
SET job_application_id = matched.application_id
FROM (
  SELECT DISTINCT ON (wr_inner.id)
    wr_inner.id AS resume_id,
    ja.id AS application_id
  FROM public.worker_resumes wr_inner
  INNER JOIN public.job_applications ja
    ON ja.worker_id = wr_inner.worker_id
   AND ja.tenant_id = wr_inner.tenant_id
  WHERE wr_inner.job_application_id IS NULL
    AND wr_inner.deleted_at IS NULL
  ORDER BY wr_inner.id, ja.created_at DESC
) matched
WHERE wr.id = matched.resume_id;
