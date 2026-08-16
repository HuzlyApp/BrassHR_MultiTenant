-- Admin-managed candidate/application statuses + per-application status history.
-- Source of truth for recruiting workflow status is job_applications.status_id
-- (application-scoped). Text job_applications.status remains a denormalized
-- system_key (or 'custom') for legacy filters / side effects.

-- ---------------------------------------------------------------------------
-- 1) Status definitions (tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  -- Optional stable key for side effects (hired / rejected / interviewing / …).
  -- Custom admin statuses leave this null.
  system_key text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_statuses_name_nonempty_chk CHECK (length(btrim(name)) > 0),
  CONSTRAINT application_statuses_system_key_chk CHECK (
    system_key IS NULL
    OR system_key IN (
      'new',
      'reviewing',
      'interviewing',
      'rejected',
      'hired',
      'shortlisted',
      'undecided',
      'withdrawn'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS application_statuses_tenant_name_uidx
  ON public.application_statuses (tenant_id, lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS application_statuses_tenant_system_key_uidx
  ON public.application_statuses (tenant_id, system_key)
  WHERE system_key IS NOT NULL;

-- At most one default per tenant
CREATE UNIQUE INDEX IF NOT EXISTS application_statuses_tenant_default_uidx
  ON public.application_statuses (tenant_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS application_statuses_tenant_sort_idx
  ON public.application_statuses (tenant_id, sort_order, name);

DROP TRIGGER IF EXISTS set_application_statuses_updated_at ON public.application_statuses;
CREATE TRIGGER set_application_statuses_updated_at
BEFORE UPDATE ON public.application_statuses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.application_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_statuses_staff_select ON public.application_statuses;
CREATE POLICY application_statuses_staff_select
  ON public.application_statuses
  FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS application_statuses_admin_insert ON public.application_statuses;
CREATE POLICY application_statuses_admin_insert
  ON public.application_statuses
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS application_statuses_admin_update ON public.application_statuses;
CREATE POLICY application_statuses_admin_update
  ON public.application_statuses
  FOR UPDATE TO authenticated
  USING (public.user_is_tenant_admin(tenant_id))
  WITH CHECK (public.user_is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS application_statuses_admin_delete ON public.application_statuses;
CREATE POLICY application_statuses_admin_delete
  ON public.application_statuses
  FOR DELETE TO authenticated
  USING (public.user_is_tenant_admin(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_statuses TO authenticated;
GRANT ALL ON public.application_statuses TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Status history (immutable audit trail; name snapshots)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications (id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES public.application_statuses (id) ON DELETE SET NULL,
  from_status_name text,
  to_status_id uuid REFERENCES public.application_statuses (id) ON DELETE SET NULL,
  to_status_name text NOT NULL,
  changed_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_status_history_note_len_chk CHECK (
    note IS NULL OR length(note) <= 4000
  )
);

CREATE INDEX IF NOT EXISTS application_status_history_app_created_idx
  ON public.application_status_history (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS application_status_history_tenant_idx
  ON public.application_status_history (tenant_id, created_at DESC);

ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

-- Staff can read; inserts go through service role / SECURITY DEFINER RPC.
DROP POLICY IF EXISTS application_status_history_staff_select ON public.application_status_history;
CREATE POLICY application_status_history_staff_select
  ON public.application_status_history
  FOR SELECT TO authenticated
  USING (public.user_is_tenant_staff(tenant_id));

GRANT SELECT ON public.application_status_history TO authenticated;
GRANT ALL ON public.application_status_history TO service_role;

-- ---------------------------------------------------------------------------
-- 3) job_applications.status_id + relax text status CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.application_statuses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_applications_status_id_idx
  ON public.job_applications (tenant_id, status_id);

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_chk;

-- Denormalized key for legacy filters; custom statuses use 'custom'.
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_chk CHECK (
    status IN (
      'new',
      'reviewing',
      'interviewing',
      'rejected',
      'hired',
      'shortlisted',
      'undecided',
      'in_progress',
      'submitted',
      'withdrawn',
      'custom'
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Seed defaults for every tenant + backfill status_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_default_application_statuses(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_defaults text[][] := ARRAY[
    ARRAY['new', 'New', '0'],
    ARRAY['reviewing', 'Reviewing', '1'],
    ARRAY['shortlisted', 'Shortlisted', '2'],
    ARRAY['interviewing', 'Interviewing', '3'],
    ARRAY['undecided', 'Undecided', '4'],
    ARRAY['hired', 'Hired', '5'],
    ARRAY['rejected', 'Rejected', '6']
  ];
  v_row text[];
  v_has_any boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.application_statuses s WHERE s.tenant_id = p_tenant_id
  ) INTO v_has_any;

  IF v_has_any THEN
    -- Ensure missing system keys exist (idempotent); do not overwrite admin renames.
    FOREACH v_row SLICE 1 IN ARRAY v_defaults LOOP
      INSERT INTO public.application_statuses (
        tenant_id, name, system_key, sort_order, is_active, is_default
      )
      SELECT
        p_tenant_id,
        v_row[2],
        v_row[1],
        v_row[3]::integer,
        true,
        (v_row[1] = 'new')
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.application_statuses s
        WHERE s.tenant_id = p_tenant_id
          AND s.system_key = v_row[1]
      );
    END LOOP;
    RETURN;
  END IF;

  FOREACH v_row SLICE 1 IN ARRAY v_defaults LOOP
    INSERT INTO public.application_statuses (
      tenant_id, name, system_key, sort_order, is_active, is_default
    ) VALUES (
      p_tenant_id,
      v_row[2],
      v_row[1],
      v_row[3]::integer,
      true,
      (v_row[1] = 'new')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_application_statuses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_application_statuses(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) TO service_role;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.ensure_default_application_statuses(t.id);
  END LOOP;
END $$;

-- Backfill status_id from legacy text status
UPDATE public.job_applications ja
SET status_id = s.id
FROM public.application_statuses s
WHERE ja.tenant_id = s.tenant_id
  AND ja.status_id IS NULL
  AND s.system_key = CASE ja.status
    WHEN 'submitted' THEN 'new'
    WHEN 'in_progress' THEN 'reviewing'
    WHEN 'withdrawn' THEN 'undecided'
    ELSE ja.status
  END;

-- Fallback: any remaining null → tenant default (or first by sort)
UPDATE public.job_applications ja
SET status_id = d.status_id,
    status = COALESCE(d.system_key, 'custom')
FROM (
  SELECT
    ja2.id AS application_id,
    s.id AS status_id,
    s.system_key
  FROM public.job_applications ja2
  CROSS JOIN LATERAL (
    SELECT s0.id, s0.system_key
    FROM public.application_statuses s0
    WHERE s0.tenant_id = ja2.tenant_id
    ORDER BY s0.is_default DESC, s0.sort_order ASC, s0.created_at ASC
    LIMIT 1
  ) s
  WHERE ja2.status_id IS NULL
) d
WHERE ja.id = d.application_id
  AND ja.status_id IS NULL;

-- Initial history for existing applications (NULL → current)
INSERT INTO public.application_status_history (
  tenant_id,
  application_id,
  from_status_id,
  from_status_name,
  to_status_id,
  to_status_name,
  changed_by_user_id,
  note
)
SELECT
  ja.tenant_id,
  ja.id,
  NULL,
  NULL,
  ja.status_id,
  COALESCE(s.name, ja.status),
  NULL,
  NULL
FROM public.job_applications ja
LEFT JOIN public.application_statuses s ON s.id = ja.status_id
WHERE ja.status_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.application_status_history h
    WHERE h.application_id = ja.id
  );

-- ---------------------------------------------------------------------------
-- 5) Assign default status_id on insert when omitted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_applications_assign_default_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status record;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_default_application_statuses(NEW.tenant_id);

  IF NEW.status_id IS NULL THEN
    SELECT s.id, s.system_key, s.name
    INTO v_status
    FROM public.application_statuses s
    WHERE s.tenant_id = NEW.tenant_id
      AND s.is_active = true
    ORDER BY s.is_default DESC, s.sort_order ASC, s.created_at ASC
    LIMIT 1;

    IF v_status.id IS NOT NULL THEN
      NEW.status_id := v_status.id;
      NEW.status := COALESCE(v_status.system_key, 'custom');
    END IF;
  ELSE
    SELECT s.id, s.system_key, s.name
    INTO v_status
    FROM public.application_statuses s
    WHERE s.id = NEW.status_id
      AND s.tenant_id = NEW.tenant_id;

    IF FOUND THEN
      NEW.status := COALESCE(v_status.system_key, 'custom');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_applications_assign_default_status_trg ON public.job_applications;
CREATE TRIGGER job_applications_assign_default_status_trg
BEFORE INSERT ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.job_applications_assign_default_status();

-- After insert: create initial history when none exists
CREATE OR REPLACE FUNCTION public.job_applications_initial_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name
  FROM public.application_statuses
  WHERE id = NEW.status_id;

  INSERT INTO public.application_status_history (
    tenant_id,
    application_id,
    from_status_id,
    from_status_name,
    to_status_id,
    to_status_name,
    changed_by_user_id,
    note
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NULL,
    NULL,
    NEW.status_id,
    COALESCE(v_name, NEW.status),
    NULL,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_applications_initial_status_history_trg ON public.job_applications;
CREATE TRIGGER job_applications_initial_status_history_trg
AFTER INSERT ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.job_applications_initial_status_history();

-- ---------------------------------------------------------------------------
-- 6) Atomic status change RPC (update + history)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_job_application_status(
  p_tenant_id uuid,
  p_application_id uuid,
  p_to_status_id uuid,
  p_changed_by_user_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app record;
  v_from record;
  v_to record;
  v_history_id uuid;
  v_note text;
BEGIN
  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND length(v_note) > 4000 THEN
    RAISE EXCEPTION 'Note too long' USING ERRCODE = '22001';
  END IF;

  SELECT ja.id, ja.tenant_id, ja.status_id, ja.status
  INTO v_app
  FROM public.job_applications ja
  WHERE ja.id = p_application_id
    AND ja.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.id, s.name, s.system_key, s.is_active, s.tenant_id
  INTO v_to
  FROM public.application_statuses s
  WHERE s.id = p_to_status_id
    AND s.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status not found for tenant' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_to.is_active THEN
    RAISE EXCEPTION 'Status is inactive' USING ERRCODE = '22000';
  END IF;

  IF v_app.status_id IS NOT DISTINCT FROM v_to.id THEN
    RETURN jsonb_build_object(
      'unchanged', true,
      'application', jsonb_build_object(
        'id', v_app.id,
        'statusId', v_to.id,
        'status', COALESCE(v_to.system_key, 'custom'),
        'statusName', v_to.name
      ),
      'history', NULL
    );
  END IF;

  IF v_app.status_id IS NOT NULL THEN
    SELECT s.id, s.name, s.system_key
    INTO v_from
    FROM public.application_statuses s
    WHERE s.id = v_app.status_id;
  END IF;

  UPDATE public.job_applications
  SET
    status_id = v_to.id,
    status = COALESCE(v_to.system_key, 'custom'),
    updated_at = now()
  WHERE id = v_app.id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.application_status_history (
    tenant_id,
    application_id,
    from_status_id,
    from_status_name,
    to_status_id,
    to_status_name,
    changed_by_user_id,
    note
  ) VALUES (
    p_tenant_id,
    v_app.id,
    v_from.id,
    v_from.name,
    v_to.id,
    v_to.name,
    p_changed_by_user_id,
    v_note
  )
  RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'unchanged', false,
    'application', jsonb_build_object(
      'id', v_app.id,
      'statusId', v_to.id,
      'status', COALESCE(v_to.system_key, 'custom'),
      'statusName', v_to.name
    ),
    'history', jsonb_build_object(
      'id', v_history_id,
      'fromStatusId', v_from.id,
      'fromStatusName', v_from.name,
      'toStatusId', v_to.id,
      'toStatusName', v_to.name,
      'note', v_note,
      'changedByUserId', p_changed_by_user_id,
      'changedAt', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_job_application_status(uuid, uuid, uuid, uuid, text) TO service_role;

COMMENT ON TABLE public.application_statuses IS
  'Tenant-scoped recruiting statuses for job applications. Admin-managed; recruiters assign only.';
COMMENT ON TABLE public.application_status_history IS
  'Immutable per-application status change audit trail with optional note and name snapshots.';
COMMENT ON COLUMN public.job_applications.status_id IS
  'FK to application_statuses — source of truth for recruiting workflow status on this application.';
