-- Generalize screening-only checklist table to all pipeline checklist items.

ALTER TABLE public.worker_screening_checklist_items
  RENAME TO worker_pipeline_checklist_items;

ALTER TABLE public.worker_pipeline_checklist_items
  DROP CONSTRAINT IF EXISTS worker_screening_checklist_items_item_key_check;

ALTER TABLE public.worker_pipeline_checklist_items
  ADD CONSTRAINT worker_pipeline_checklist_items_item_key_check
  CHECK (
    item_key IN (
      'call_1',
      'call_2',
      'oig',
      'drug',
      'bg',
      'fac_approval',
      'sworn',
      'w2_i9',
      'everify',
      'wheniwork',
      'paychex',
      'welcome_email',
      'badge'
    )
  );

ALTER INDEX IF EXISTS worker_screening_checklist_items_worker_idx
  RENAME TO worker_pipeline_checklist_items_worker_idx;

ALTER INDEX IF EXISTS worker_screening_checklist_items_tenant_idx
  RENAME TO worker_pipeline_checklist_items_tenant_idx;

COMMENT ON TABLE public.worker_pipeline_checklist_items IS
  'Per-worker pipeline checklist completion (manual recruiter toggle + optional auto-sync e.g. call logs).';

DROP POLICY IF EXISTS worker_screening_checklist_staff ON public.worker_pipeline_checklist_items;
DROP POLICY IF EXISTS worker_screening_checklist_worker_select ON public.worker_pipeline_checklist_items;

DROP POLICY IF EXISTS worker_pipeline_checklist_staff ON public.worker_pipeline_checklist_items;
CREATE POLICY worker_pipeline_checklist_staff
  ON public.worker_pipeline_checklist_items
  FOR ALL
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS worker_pipeline_checklist_worker_select ON public.worker_pipeline_checklist_items;
CREATE POLICY worker_pipeline_checklist_worker_select
  ON public.worker_pipeline_checklist_items
  FOR SELECT
  TO authenticated
  USING (public.worker_belongs_to_auth(worker_id));
