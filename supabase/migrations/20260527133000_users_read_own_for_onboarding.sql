-- Owners without a tenant yet must read their own users row for onboarding guards.

DROP POLICY IF EXISTS users_read_own ON public.users;
CREATE POLICY users_read_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
