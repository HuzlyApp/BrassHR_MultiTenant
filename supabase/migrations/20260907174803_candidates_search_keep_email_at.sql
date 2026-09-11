-- Keep @ in free-text normalization so email search remains exact.
-- (Function body already updated in candidates_search_rpc_skills for fresh installs;
-- this migration records the remote hotfix that preserved email @ characters.)

COMMENT ON FUNCTION public.list_candidate_ids_page IS
  'Tenant-scoped paginated candidate IDs. Free-text (p_search) ORs across name/email/phone/role/apps/resume/skills (preserves @ in emails). Skills (p_skills) AND together; when both set, free-text AND skills. SECURITY INVOKER.';
