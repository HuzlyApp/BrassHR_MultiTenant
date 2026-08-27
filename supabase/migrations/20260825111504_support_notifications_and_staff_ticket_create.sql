-- Support tickets + notifications: deep-link column, user-scoped RLS, staff create policy

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

COMMENT ON COLUMN public.notifications.link IS
  'In-app path to open when the notification is selected (tenant-relative).';

CREATE INDEX IF NOT EXISTS notifications_user_unread_sent_at_idx
  ON public.notifications (user_id, is_read, sent_at DESC);

-- Replace broad tenant-only policy with user-scoped + staff read within tenant.
DROP POLICY IF EXISTS tenant_isolation ON public.notifications;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_service_or_staff ON public.notifications;
-- Inserts are performed via service role from API routes; no authenticated insert needed.

-- Allow staff to create tickets on behalf of a worker (requester remains the worker).
DROP POLICY IF EXISTS support_tickets_staff_insert ON public.support_tickets;
CREATE POLICY support_tickets_staff_insert
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id IS NOT NULL
    AND public.user_is_tenant_staff(tenant_id)
    AND tenant_id = (
      SELECT w.tenant_id
      FROM public.worker w
      WHERE w.id = support_tickets.applicant_id
      LIMIT 1
    )
    AND (
      recruiter_id IS NULL
      OR recruiter_id = auth.uid()
    )
  );
