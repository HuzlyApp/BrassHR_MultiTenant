-- Columns used by the admin Workers page (employment records).

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('new', 'active', 'inactive', 'terminated'));

CREATE INDEX IF NOT EXISTS workers_worker_type_idx ON public.workers (worker_type);
CREATE INDEX IF NOT EXISTS workers_status_idx ON public.workers (status);

UPDATE public.workers w
SET
  job_role = wr.job_role,
  location = NULLIF(
    TRIM(
      CONCAT_WS(
        ', ',
        NULLIF(TRIM(wr.city), ''),
        NULLIF(TRIM(wr.state), '')
      )
    ),
    ''
  ),
  status = COALESCE(NULLIF(TRIM(w.status), ''), 'active')
FROM public.worker wr
WHERE wr.id = w.candidate_id
  AND (w.job_role IS NULL OR w.location IS NULL);
