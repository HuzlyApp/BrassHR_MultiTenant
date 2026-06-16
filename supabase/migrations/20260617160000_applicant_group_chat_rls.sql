-- Applicant access to assigned group chats only

CREATE OR REPLACE FUNCTION public.applicant_assigned_to_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.worker w ON w.id = gm.user_id::uuid
    WHERE gm.group_id = p_group_id
      AND w.user_id = auth.uid()
      AND lower(trim(coalesce(w.status, ''))) = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.applicant_assigned_to_group(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.applicant_assigned_to_group(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS groups_select_applicant ON public.groups;
CREATE POLICY groups_select_applicant
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (public.applicant_assigned_to_group(id));

DROP POLICY IF EXISTS group_members_select_applicant ON public.group_members;
CREATE POLICY group_members_select_applicant
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (public.applicant_assigned_to_group(group_id));

DROP POLICY IF EXISTS group_messages_select_applicant ON public.group_messages;
CREATE POLICY group_messages_select_applicant
  ON public.group_messages
  FOR SELECT
  TO authenticated
  USING (public.applicant_assigned_to_group(group_id));

DROP POLICY IF EXISTS group_messages_insert_applicant ON public.group_messages;
CREATE POLICY group_messages_insert_applicant
  ON public.group_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.applicant_assigned_to_group(group_id)
    AND sender_role = 'worker'
    AND sender_id = (
      SELECT w.id::text
      FROM public.worker w
      WHERE w.user_id = auth.uid()
      LIMIT 1
    )
  );
