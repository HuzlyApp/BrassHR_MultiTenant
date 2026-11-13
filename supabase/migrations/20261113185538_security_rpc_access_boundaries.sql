-- Internal server RPCs: revoking PUBLIC alone leaves explicit API-role grants.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'bulk_delete_workers', 'claim_worker_candidates', 'claim_job_applications',
      'build_employment_worker_application_snapshot',
      'build_employment_worker_documents_manifest',
      'convert_candidate_to_employment_worker', 'activate_post_hire',
      'issue_auth_login_otp', 'consume_auth_login_otp',
      'seed_tenant_role_access', 'seed_tenant_onboarding_libraries',
      'seed_tenant_profession_catalog', 'seed_profession_upload_documents'
    ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- Internal migration output must not be an anonymous Data API endpoint.
ALTER TABLE IF EXISTS public.default_workflow_migration_report ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.default_workflow_migration_report FROM anon, authenticated;
