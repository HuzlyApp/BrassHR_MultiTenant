-- Reconcile both completion and reopened requirements; preserve manual inactive/terminated states.
CREATE OR REPLACE FUNCTION public.sync_completed_worker_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_application uuid;
BEGIN
  IF TG_TABLE_NAME='job_applications' THEN
    v_application := NEW.id;
  ELSE
    SELECT wi.application_id INTO v_application FROM public.applicant_workflow_instances wi WHERE wi.id=NEW.workflow_instance_id AND wi.tenant_id=NEW.tenant_id;
  END IF;
  UPDATE public.workers w SET status=CASE WHEN public.employment_worker_onboarding_complete(w.tenant_id,w.candidate_id,w.source_job_application_id,w.worker_type) THEN 'active' ELSE 'new' END,updated_at=now()
    WHERE w.tenant_id=NEW.tenant_id AND w.source_job_application_id=v_application AND lower(w.status) IN ('active','new')
      AND (lower(w.status)='active') IS DISTINCT FROM public.employment_worker_onboarding_complete(w.tenant_id,w.candidate_id,w.source_job_application_id,w.worker_type);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_completed_worker_activation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_completed_worker_activation() TO service_role;
DROP TRIGGER sync_worker_activation_on_application ON public.job_applications;
CREATE TRIGGER sync_worker_activation_on_application AFTER UPDATE OF status,workflow_phase,workflow_id,applicant_workflow_instance_id,post_hire_suspended_at ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.sync_completed_worker_activation();
DROP TRIGGER sync_worker_activation_on_step ON public.applicant_workflow_step_records;
CREATE TRIGGER sync_worker_activation_on_step AFTER UPDATE OF status,phase,is_required ON public.applicant_workflow_step_records FOR EACH ROW EXECUTE FUNCTION public.sync_completed_worker_activation();
