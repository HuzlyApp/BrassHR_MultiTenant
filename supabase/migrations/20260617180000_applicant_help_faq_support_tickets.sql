-- Applicant portal help assistant: FAQ read access and support ticket fields

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS applicant_id uuid REFERENCES public.worker (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_priority_check'
      AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_priority_check
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;
END $$;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS support_tickets_applicant_idx
  ON public.support_tickets (applicant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS faqs_tenant_category_idx
  ON public.faqs (tenant_id, category);

DROP POLICY IF EXISTS faqs_select_applicant ON public.faqs;
CREATE POLICY faqs_select_applicant
  ON public.faqs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = (
      SELECT w.tenant_id
      FROM public.worker w
      WHERE w.user_id = auth.uid()
        AND lower(trim(coalesce(w.status, ''))) = 'approved'
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS faqs_staff ON public.faqs;
CREATE POLICY faqs_staff
  ON public.faqs
  FOR ALL
  TO authenticated
  USING (
    tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id)
  )
  WITH CHECK (
    tenant_id IS NOT NULL AND public.user_is_tenant_staff(tenant_id)
  );

DROP POLICY IF EXISTS support_tickets_applicant_select ON public.support_tickets;
CREATE POLICY support_tickets_applicant_select
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      applicant_id IS NOT NULL
      AND public.approved_applicant_owns_worker(applicant_id)
    )
  );

DROP POLICY IF EXISTS support_tickets_applicant_insert ON public.support_tickets;
CREATE POLICY support_tickets_applicant_insert
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND applicant_id IS NOT NULL
    AND public.approved_applicant_owns_worker(applicant_id)
    AND tenant_id = (
      SELECT w.tenant_id
      FROM public.worker w
      WHERE w.id = applicant_id
      LIMIT 1
    )
  );

COMMENT ON COLUMN public.support_tickets.applicant_id IS 'Worker/applicant who opened the ticket from the applicant portal.';
COMMENT ON COLUMN public.support_tickets.source IS 'Origin of the ticket, e.g. ai_fallback or manual.';
COMMENT ON COLUMN public.support_tickets.category IS 'Issue category for routing support requests.';
