-- Count unique active candidate profiles in one database call.
-- Matches the Jobs dashboard helper: active pipeline, exclude converted workers
-- and employment rows, then connect profiles that share an email or a
-- phone (last 10 digits) + name. Callers fall back to paged reads until this
-- function is deployed.

CREATE OR REPLACE FUNCTION public.count_unique_active_candidate_profiles(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  unkeyed integer := 0;
  keyed integer := 0;
  round integer := 0;
  moved integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS candidate_profile_count_nodes (
    rn integer PRIMARY KEY,
    email_key text,
    phone_key text,
    comp integer NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE candidate_profile_count_nodes;

  INSERT INTO candidate_profile_count_nodes (rn, email_key, phone_key, comp)
  SELECT rn, email_key, phone_key, rn
  FROM (
    SELECT
      row_number() OVER ()::integer AS rn,
      email_key,
      phone_key
    FROM (
    SELECT
      NULLIF(lower(btrim(coalesce(w.email, ''))), '') AS email_key,
      CASE
        WHEN length(regexp_replace(coalesce(w.phone, ''), '\D', '', 'g')) >= 10
         AND length(
           btrim(concat_ws(
             ' ',
             nullif(btrim(coalesce(w.first_name, '')), ''),
             nullif(btrim(coalesce(w.last_name, '')), '')
           ))
         ) > 0
        THEN right(regexp_replace(coalesce(w.phone, ''), '\D', '', 'g'), 10) || ':' ||
             regexp_replace(
               lower(btrim(concat_ws(
                 ' ',
                 nullif(btrim(coalesce(w.first_name, '')), ''),
                 nullif(btrim(coalesce(w.last_name, '')), '')
               ))),
               '\s+',
               ' ',
               'g'
             )
        ELSE NULL
      END AS phone_key
    FROM public.worker w
    WHERE w.tenant_id = p_tenant_id
      AND NOT EXISTS (
        SELECT 1 FROM public.workers emp WHERE emp.candidate_id = w.id
      )
      AND lower(btrim(coalesce(w.status, ''))) <> 'converted'
      AND lower(btrim(coalesce(w.status, ''))) NOT IN ('disapproved', 'rejected')
      AND (
        w.status IS NULL
        OR btrim(w.status) = ''
        OR lower(btrim(w.status)) IN ('new', 'pending', 'under_review', 'for_approval', 'approved')
      )
  ) base
  ) numbered;

  SELECT count(*)::integer INTO unkeyed
  FROM candidate_profile_count_nodes
  WHERE email_key IS NULL AND phone_key IS NULL;

  DELETE FROM candidate_profile_count_nodes
  WHERE email_key IS NULL AND phone_key IS NULL;

  CREATE INDEX IF NOT EXISTS candidate_profile_count_nodes_email_idx
    ON candidate_profile_count_nodes (email_key);
  CREATE INDEX IF NOT EXISTS candidate_profile_count_nodes_phone_idx
    ON candidate_profile_count_nodes (phone_key);

  LOOP
    round := round + 1;
    EXIT WHEN round > 16;

    WITH email_min AS (
      SELECT email_key, min(comp) AS comp
      FROM candidate_profile_count_nodes
      WHERE email_key IS NOT NULL
      GROUP BY email_key
    ),
    phone_min AS (
      SELECT phone_key, min(comp) AS comp
      FROM candidate_profile_count_nodes
      WHERE phone_key IS NOT NULL
      GROUP BY phone_key
    ),
    next_comp AS (
      SELECT
        n.rn,
        LEAST(n.comp, COALESCE(e.comp, n.comp), COALESCE(p.comp, n.comp)) AS comp
      FROM candidate_profile_count_nodes n
      LEFT JOIN email_min e ON e.email_key = n.email_key
      LEFT JOIN phone_min p ON p.phone_key = n.phone_key
    )
    UPDATE candidate_profile_count_nodes n
    SET comp = next_comp.comp
    FROM next_comp
    WHERE n.rn = next_comp.rn
      AND n.comp IS DISTINCT FROM next_comp.comp;

    GET DIAGNOSTICS moved = ROW_COUNT;
    EXIT WHEN moved = 0;
  END LOOP;

  SELECT count(*)::integer INTO keyed FROM (
    SELECT DISTINCT comp FROM candidate_profile_count_nodes
  ) groups;

  RETURN unkeyed + keyed;
END;
$$;

COMMENT ON FUNCTION public.count_unique_active_candidate_profiles(uuid) IS
  'Unique active candidate profiles for one tenant. SECURITY INVOKER so RLS still applies.';

REVOKE ALL ON FUNCTION public.count_unique_active_candidate_profiles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_unique_active_candidate_profiles(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.count_unique_active_candidate_profiles(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_unique_active_candidate_profiles(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
