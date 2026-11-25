-- Employment may be provisioned during hiring, but Active requires the complete assigned W2/1099 workflow.
CREATE OR REPLACE FUNCTION public.employment_worker_onboarding_complete(p_tenant uuid, p_candidate uuid, p_application uuid, p_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.onboarding_flows f ON f.id=ja.workflow_id AND f.tenant_id=ja.tenant_id
    JOIN public.applicant_workflow_instances wi ON wi.id=ja.applicant_workflow_instance_id AND wi.tenant_id=ja.tenant_id AND wi.worker_id=ja.worker_id
    WHERE ja.tenant_id=p_tenant AND ja.id=p_application AND ja.worker_id=p_candidate
      AND lower(coalesce(ja.status,''))='hired' AND ja.post_hire_suspended_at IS NULL
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g') IN ('w2','1099')
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g')=regexp_replace(lower(p_type),'[^a-z0-9]','','g')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND sr.phase='pre_hire')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND sr.phase='post_hire')
      AND NOT EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND coalesce(sr.is_required,true) AND lower(coalesce(sr.status,'')) NOT IN ('completed','complete','approved','signed'))
  );
$$;
REVOKE ALL ON FUNCTION public.employment_worker_onboarding_complete(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employment_worker_onboarding_complete(uuid,uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_employment_worker_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF lower(coalesce(NEW.status,''))='active' AND NOT public.employment_worker_onboarding_complete(NEW.tenant_id,NEW.candidate_id,NEW.source_job_application_id,NEW.worker_type) THEN
    IF TG_OP='INSERT' THEN
      NEW.status := 'new';
    ELSE
      RAISE EXCEPTION 'Complete the assigned W2 or 1099 pre-hire and post-hire workflow before activating this worker.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_employment_worker_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_employment_worker_activation() TO service_role;
CREATE TRIGGER guard_employment_worker_activation BEFORE INSERT OR UPDATE OF status,tenant_id,candidate_id,source_job_application_id,worker_type ON public.workers FOR EACH ROW EXECUTE FUNCTION public.guard_employment_worker_activation();

CREATE OR REPLACE FUNCTION public.sync_completed_worker_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_application uuid;
BEGIN
  IF TG_TABLE_NAME='job_applications' THEN
    v_application := NEW.id;
  ELSE
    SELECT wi.application_id INTO v_application FROM public.applicant_workflow_instances wi WHERE wi.id=NEW.workflow_instance_id AND wi.tenant_id=NEW.tenant_id;
  END IF;
  UPDATE public.workers w SET status='active',updated_at=now()
    WHERE w.tenant_id=NEW.tenant_id AND w.source_job_application_id=v_application AND lower(w.status)='new'
      AND public.employment_worker_onboarding_complete(w.tenant_id,w.candidate_id,w.source_job_application_id,w.worker_type);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_completed_worker_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_completed_worker_activation() TO service_role;
CREATE TRIGGER sync_worker_activation_on_application AFTER UPDATE OF status,workflow_phase ON public.job_applications FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.workflow_phase IS DISTINCT FROM NEW.workflow_phase) EXECUTE FUNCTION public.sync_completed_worker_activation();
CREATE TRIGGER sync_worker_activation_on_step AFTER UPDATE OF status ON public.applicant_workflow_step_records FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.sync_completed_worker_activation();
