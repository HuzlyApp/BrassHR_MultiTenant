-- Manual + call-log completion for Initial Screening / Interview checklist items (Call 1, Call 2).

CREATE TABLE IF NOT EXISTS public.worker_screening_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.worker (id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (item_key IN ('call_1', 'call_2')),
  manual_completed boolean NOT NULL DEFAULT false,
  manual_completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  manual_completed_at timestamptz,
  call_log_completed boolean NOT NULL DEFAULT false,
  call_log_completed_at timestamptz,
  call_log_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, item_key)
);

CREATE INDEX IF NOT EXISTS worker_screening_checklist_items_worker_idx
  ON public.worker_screening_checklist_items (worker_id);

CREATE INDEX IF NOT EXISTS worker_screening_checklist_items_tenant_idx
  ON public.worker_screening_checklist_items (tenant_id);

COMMENT ON TABLE public.worker_screening_checklist_items IS
  'Per-worker Initial Screening checklist completion (manual recruiter toggle + future call-log sync).';

ALTER TABLE public.worker_screening_checklist_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.worker_screening_checklist_items TO authenticated;
GRANT ALL ON public.worker_screening_checklist_items TO service_role;

DROP POLICY IF EXISTS worker_screening_checklist_staff ON public.worker_screening_checklist_items;
CREATE POLICY worker_screening_checklist_staff
  ON public.worker_screening_checklist_items
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_screening_checklist_worker_select ON public.worker_screening_checklist_items;
CREATE POLICY worker_screening_checklist_worker_select
  ON public.worker_screening_checklist_items
  FOR SELECT
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));
