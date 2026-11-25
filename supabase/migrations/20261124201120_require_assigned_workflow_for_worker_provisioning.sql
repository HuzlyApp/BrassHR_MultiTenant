-- Enforce the assigned-workflow rule at creation, including non-Active inserts.
CREATE OR REPLACE FUNCTION public.employment_worker_onboarding_complete(p_tenant uuid, p_candidate uuid, p_application uuid, p_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.onboarding_flows f ON f.id=ja.workflow_id AND f.tenant_id=ja.tenant_id
    JOIN public.applicant_workflow_instances wi ON wi.id=ja.applicant_workflow_instance_id AND wi.tenant_id=ja.tenant_id AND wi.worker_id=ja.worker_id AND wi.application_id=ja.id
    WHERE ja.tenant_id=p_tenant AND ja.id=p_application AND ja.worker_id=p_candidate
      AND lower(coalesce(ja.status,''))='hired' AND ja.post_hire_suspended_at IS NULL
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g') IN ('w2','1099')
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g')=regexp_replace(lower(p_type),'[^a-z0-9]','','g')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND sr.phase='pre_hire')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND sr.phase='post_hire')
      AND NOT EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=p_tenant AND sr.workflow_instance_id=wi.id AND coalesce(sr.is_required,true) AND lower(coalesce(sr.status,'')) NOT IN ('completed','complete','approved','signed'))
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_employment_worker_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.job_applications ja
    JOIN public.onboarding_flows f ON f.id=ja.workflow_id AND f.tenant_id=ja.tenant_id
    JOIN public.applicant_workflow_instances wi ON wi.id=ja.applicant_workflow_instance_id AND wi.tenant_id=ja.tenant_id AND wi.worker_id=ja.worker_id AND wi.application_id=ja.id
    WHERE ja.tenant_id=NEW.tenant_id AND ja.id=NEW.source_job_application_id AND ja.worker_id=NEW.candidate_id
      AND lower(coalesce(ja.status,'')) NOT IN ('closed','rejected','withdrawn','archived','disapproved','cancelled')
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g') IN ('w2','1099')
      AND regexp_replace(lower(f.employment_type),'[^a-z0-9]','','g')=regexp_replace(lower(NEW.worker_type),'[^a-z0-9]','','g')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=NEW.tenant_id AND sr.workflow_instance_id=wi.id AND sr.phase='pre_hire')
      AND EXISTS (SELECT 1 FROM public.applicant_workflow_step_records sr WHERE sr.tenant_id=NEW.tenant_id AND sr.workflow_instance_id=wi.id AND sr.phase='post_hire')
  ) THEN
    RAISE EXCEPTION 'Assign a matching W2 or 1099 workflow with pre-hire and post-hire steps before creating a worker.' USING ERRCODE='23514';
  END IF;
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
