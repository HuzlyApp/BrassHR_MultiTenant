CREATE TABLE public.worker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  worker_id uuid NOT NULL REFERENCES public.worker(id),
  request_type text NOT NULL CHECK(request_type IN ('time_off','schedule_change','time_adjustment','other')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK(end_date >= start_date),
  reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 1 AND 2000),
  notes text CHECK(char_length(notes) <= 4000),
  off_type text CHECK(off_type IN ('Vacation','Sick Leave','Personal Leave','Training','Regular Off')),
  facility_id uuid REFERENCES public.facility(id),
  department_id uuid REFERENCES public.departments(id),
  related_shift_id uuid REFERENCES public.shifts(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text CHECK(char_length(review_notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  CHECK((request_type='time_off' AND off_type IS NOT NULL) OR (request_type<>'time_off' AND off_type IS NULL)),
  CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
     OR (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX worker_requests_tenant_status_dates_idx ON public.worker_requests(tenant_id,status,start_date,end_date);
CREATE INDEX worker_requests_tenant_worker_idx ON public.worker_requests(tenant_id,worker_id,created_at);
CREATE INDEX worker_requests_facility_idx ON public.worker_requests(facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX worker_requests_department_idx ON public.worker_requests(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX worker_requests_shift_idx ON public.worker_requests(related_shift_id) WHERE related_shift_id IS NOT NULL;
CREATE INDEX worker_requests_creator_idx ON public.worker_requests(created_by);
CREATE INDEX worker_requests_reviewer_idx ON public.worker_requests(reviewed_by) WHERE reviewed_by IS NOT NULL;

CREATE FUNCTION public.assert_worker_request_scope() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.worker WHERE tenant_id=NEW.tenant_id AND id=NEW.worker_id) THEN
    RAISE EXCEPTION 'Worker not found in tenant' USING ERRCODE='23503';
  END IF;
  IF NEW.facility_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.facility WHERE tenant_id=NEW.tenant_id AND id=NEW.facility_id) THEN
    RAISE EXCEPTION 'Facility not found in tenant' USING ERRCODE='23503';
  END IF;
  IF NEW.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE tenant_id=NEW.tenant_id AND id=NEW.department_id) THEN
    RAISE EXCEPTION 'Department not found in tenant' USING ERRCODE='23503';
  END IF;
  IF NEW.related_shift_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shifts WHERE tenant_id=NEW.tenant_id AND id=NEW.related_shift_id) THEN
    RAISE EXCEPTION 'Shift not found in tenant' USING ERRCODE='23503';
  END IF;
  IF TG_OP='INSERT' AND NEW.status<>'pending' THEN
    RAISE EXCEPTION 'Requests start pending' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status<>'pending' OR NEW.status NOT IN ('approved','rejected')
      OR ROW(NEW.tenant_id,NEW.worker_id,NEW.request_type,NEW.start_date,NEW.end_date,NEW.reason,NEW.notes,
        NEW.off_type,NEW.facility_id,NEW.department_id,NEW.related_shift_id,NEW.created_by)
        IS DISTINCT FROM ROW(OLD.tenant_id,OLD.worker_id,OLD.request_type,OLD.start_date,OLD.end_date,OLD.reason,OLD.notes,
          OLD.off_type,OLD.facility_id,OLD.department_id,OLD.related_shift_id,OLD.created_by) THEN
      RAISE EXCEPTION 'Only pending requests can be reviewed; request details are immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.updated_at:=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assert_worker_request_scope() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_worker_request_scope() TO service_role;
CREATE TRIGGER trg_worker_request_scope BEFORE INSERT OR UPDATE ON public.worker_requests
FOR EACH ROW EXECUTE FUNCTION public.assert_worker_request_scope();

ALTER TABLE public.worker_time_off ADD COLUMN source_request_id uuid;
ALTER TABLE public.worker_time_off ADD CONSTRAINT worker_time_off_request_tenant_fk
  FOREIGN KEY(tenant_id,source_request_id) REFERENCES public.worker_requests(tenant_id,id);
CREATE UNIQUE INDEX worker_time_off_source_request_uidx ON public.worker_time_off(source_request_id) WHERE source_request_id IS NOT NULL;
CREATE FUNCTION public.assert_request_leave_link() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.source_request_id IS NOT NULL AND NEW.source_request_id IS DISTINCT FROM OLD.source_request_id THEN
    RAISE EXCEPTION 'Linked leave source cannot change' USING ERRCODE='23514';
  END IF;
  IF NEW.source_request_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.worker_requests r WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.source_request_id
      AND r.request_type='time_off' AND r.status='approved' AND r.worker_id=NEW.worker_id
      AND r.start_date=NEW.start_date AND r.end_date=NEW.end_date AND r.off_type=NEW.off_type
      AND r.facility_id IS NOT DISTINCT FROM NEW.facility_id
  ) THEN RAISE EXCEPTION 'Leave must match its approved time-off request' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assert_request_leave_link() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_request_leave_link() TO service_role;
CREATE TRIGGER trg_request_leave_link BEFORE INSERT OR UPDATE ON public.worker_time_off
FOR EACH ROW EXECUTE FUNCTION public.assert_request_leave_link();

CREATE FUNCTION public.review_worker_request(p_tenant_id uuid,p_request_id uuid,p_actor_id uuid,p_decision text,p_notes text DEFAULT NULL)
RETURNS public.worker_requests LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.worker_requests%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('approved','rejected') OR p_decision IS NULL OR char_length(p_notes)>4000 THEN
    RAISE EXCEPTION 'Invalid review' USING ERRCODE='23514';
  END IF;
  -- Recheck the stored grant and live membership, not a role supplied by the client.
  IF NOT EXISTS(
    SELECT 1 FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id=u.id AND ur.tenant_id=p_tenant_id
    WHERE u.id=p_actor_id AND u.is_active AND NOT u.must_change_password
      AND (u.god_admin OR (
        (ur.is_active OR (ur.user_id IS NULL AND u.tenant_id=p_tenant_id)) AND EXISTS(
          SELECT 1 FROM public.tenant_roles tr
          JOIN public.tenant_role_permissions rp ON rp.tenant_id=tr.tenant_id AND rp.role_key=tr.role_key
          WHERE tr.tenant_id=p_tenant_id AND rp.tenant_id=p_tenant_id AND rp.resource_key='scheduling' AND rp.can_edit
            AND (tr.role_key=coalesce(ur.role,u.role) OR EXISTS(
              SELECT 1 FROM public.staff_roles sr WHERE sr.is_active AND sr.is_staff AND sr.key=tr.role_key
                AND (sr.storage_key=coalesce(ur.role,u.role) OR coalesce(ur.role,u.role)=ANY(sr.aliases))
            ))
        )
      ))
  ) THEN RAISE EXCEPTION 'Review permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.worker_requests WHERE tenant_id=p_tenant_id AND id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found in tenant' USING ERRCODE='P0002'; END IF;
  IF EXISTS(SELECT 1 FROM public.worker WHERE tenant_id=p_tenant_id AND id=r.worker_id AND user_id=p_actor_id) THEN
    RAISE EXCEPTION 'Another reviewer must review this request' USING ERRCODE='42501';
  END IF;
  IF r.status=p_decision THEN RETURN r; END IF;
  IF r.status<>'pending' THEN RAISE EXCEPTION 'Request already reviewed' USING ERRCODE='P0001'; END IF;
  UPDATE public.worker_requests SET status=p_decision,reviewed_by=p_actor_id,reviewed_at=now(),review_notes=p_notes
    WHERE tenant_id=p_tenant_id AND id=p_request_id RETURNING * INTO r;
  IF p_decision='approved' AND r.request_type='time_off' THEN
    INSERT INTO public.worker_time_off(tenant_id,worker_id,facility_id,off_type,start_date,end_date,notes,source_request_id)
      VALUES(p_tenant_id,r.worker_id,r.facility_id,r.off_type,r.start_date,r.end_date,r.notes,r.id);
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.review_worker_request(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_worker_request(uuid,uuid,uuid,text,text) TO service_role;
ALTER TABLE public.worker_requests ENABLE ROW LEVEL SECURITY;
-- Request notes are exposed only by scoped, grant-checked server routes.
CREATE POLICY worker_requests_server_only ON public.worker_requests FOR SELECT TO authenticated USING (false);
REVOKE ALL ON public.worker_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.worker_requests TO service_role;
-- Existing leave reads remain compatible; writes must not bypass the review workflow.
REVOKE INSERT,UPDATE,DELETE ON public.worker_time_off FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.worker_time_off TO service_role;
NOTIFY pgrst, 'reload schema';
