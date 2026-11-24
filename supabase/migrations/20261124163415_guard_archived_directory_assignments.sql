-- Keep historical assignments intact; reject only new/reassigned directory references.
CREATE FUNCTION public.guard_archived_shift_directory() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.tenant_id = NEW.tenant_id AND c.id = NEW.client_id AND c.archived_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM public.facility f WHERE f.tenant_id = NEW.tenant_id AND f.id = NEW.facility_id AND f.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Restore the archived client or facility before creating a shift.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_archived_shift_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_archived_shift_directory() TO service_role;
CREATE TRIGGER trg_guard_archived_shift_directory BEFORE INSERT OR UPDATE OF facility_id, client_id ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_shift_directory();

CREATE FUNCTION public.guard_archived_assignment_directory() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workers ew
    JOIN public.worker w ON w.tenant_id = ew.tenant_id AND w.id = ew.candidate_id
    WHERE ew.tenant_id = NEW.tenant_id AND ew.archived_at IS NOT NULL
      AND (ew.id = NEW.worker_id OR ew.candidate_id = NEW.worker_id OR w.user_id = NEW.worker_id)
  ) OR EXISTS (
    SELECT 1 FROM public.shifts s
    LEFT JOIN public.facility f ON f.tenant_id = s.tenant_id AND f.id = s.facility_id
    LEFT JOIN public.clients c ON c.tenant_id = s.tenant_id AND c.id = s.client_id
    WHERE s.tenant_id = NEW.tenant_id AND s.id = NEW.shift_id
      AND (f.archived_at IS NOT NULL OR c.archived_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Restore the archived worker, client or facility before assigning a shift.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_archived_assignment_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_archived_assignment_directory() TO service_role;
CREATE TRIGGER trg_guard_archived_assignment_directory BEFORE INSERT OR UPDATE OF worker_id, shift_id ON public.worker_shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_assignment_directory();
