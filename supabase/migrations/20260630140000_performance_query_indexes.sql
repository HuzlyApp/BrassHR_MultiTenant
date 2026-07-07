-- Performance indexes for tenant-scoped list/dashboard queries (read-heavy paths).

CREATE INDEX IF NOT EXISTS worker_tenant_status_idx
  ON public.worker (tenant_id, status);

CREATE INDEX IF NOT EXISTS worker_tenant_created_at_idx
  ON public.worker (tenant_id, created_at DESC);

DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS notifications_user_sent_at_idx
      ON public.notifications (user_id, sent_at DESC);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_submitted_documents_tenant_status_idx
  ON public.worker_submitted_documents (tenant_id, status);

DO $$ BEGIN
  IF to_regclass('public.worker_shift_assignments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS worker_shift_assignments_shift_id_idx
      ON public.worker_shift_assignments (shift_id);
    CREATE INDEX IF NOT EXISTS worker_shift_assignments_worker_id_idx
      ON public.worker_shift_assignments (worker_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS worker_onboarding_step_progress_worker_step_idx
  ON public.worker_onboarding_step_progress (worker_id, onboarding_step_id);

CREATE INDEX IF NOT EXISTS worker_onboarding_step_progress_tenant_worker_idx
  ON public.worker_onboarding_step_progress (tenant_id, worker_id);

CREATE INDEX IF NOT EXISTS agreements_tenant_status_idx
  ON public.agreements (tenant_id, status);

DO $$ BEGIN
  IF to_regclass('public.shifts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS shifts_tenant_start_date_idx
      ON public.shifts (tenant_id, start_date DESC);
  END IF;
END $$;

-- Latest message preview per ticket (avoids loading full message history for list views).
CREATE OR REPLACE FUNCTION public.latest_support_ticket_message_previews(p_ticket_ids uuid[])
RETURNS TABLE(ticket_id uuid, message text, created_at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.ticket_id) m.ticket_id, m.message, m.created_at
  FROM public.support_ticket_messages m
  WHERE m.ticket_id = ANY(p_ticket_ids)
  ORDER BY m.ticket_id, m.created_at DESC;
$$;
