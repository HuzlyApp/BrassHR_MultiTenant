-- Recruiter group chat: indexes, sender_role, RLS, realtime

CREATE UNIQUE INDEX IF NOT EXISTS group_members_group_user_uq
  ON public.group_members (group_id, user_id);

CREATE INDEX IF NOT EXISTS group_members_tenant_group_idx
  ON public.group_members (tenant_id, group_id);

CREATE INDEX IF NOT EXISTS group_members_worker_idx
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS group_messages_group_sent_idx
  ON public.group_messages (group_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS groups_tenant_created_idx
  ON public.groups (tenant_id, created_at DESC);

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'recruiter';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'group_messages_sender_role_check'
      AND conrelid = 'public.group_messages'::regclass
  ) THEN
    ALTER TABLE public.group_messages
      ADD CONSTRAINT group_messages_sender_role_check
      CHECK (sender_role IN ('recruiter', 'worker'));
  END IF;
END $$;

DROP POLICY IF EXISTS groups_select_staff ON public.groups;
CREATE POLICY groups_select_staff
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS groups_insert_staff ON public.groups;
CREATE POLICY groups_insert_staff
  ON public.groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND created_by = auth.uid()::text
  );

DROP POLICY IF EXISTS groups_delete_staff ON public.groups;
CREATE POLICY groups_delete_staff
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS group_members_select_staff ON public.group_members;
CREATE POLICY group_members_select_staff
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS group_members_insert_staff ON public.group_members;
CREATE POLICY group_members_insert_staff
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.tenant_id = tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM public.worker w
      WHERE w.id = user_id::uuid AND w.tenant_id = tenant_id
    )
  );

DROP POLICY IF EXISTS group_members_delete_staff ON public.group_members;
CREATE POLICY group_members_delete_staff
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS group_messages_select_staff ON public.group_messages;
CREATE POLICY group_messages_select_staff
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS group_messages_insert_staff ON public.group_messages;
CREATE POLICY group_messages_insert_staff
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_staff(tenant_id)
    AND sender_role = 'recruiter'
    AND sender_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.tenant_id = tenant_id
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
END $$;

COMMENT ON TABLE public.groups IS 'Recruiter-created worker group chats per tenant.';
COMMENT ON TABLE public.group_members IS 'Workers assigned to a recruiter group chat (user_id stores worker UUID).';
COMMENT ON TABLE public.group_messages IS 'Messages posted inside recruiter group chats.';
