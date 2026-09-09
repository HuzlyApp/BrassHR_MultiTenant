-- Ensure verification-note tables stay granted and PostgREST reloads them
-- into the Data API schema cache.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_application_match_requirement_notes TO authenticated;
GRANT ALL ON public.job_application_match_requirement_notes TO service_role;
GRANT SELECT, INSERT ON public.job_application_match_requirement_note_audit TO authenticated;
GRANT ALL ON public.job_application_match_requirement_note_audit TO service_role;

COMMENT ON TABLE public.job_application_match_requirement_notes IS
  'Recruiter verification notes for match-analysis requirements. One active note per requirement.';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
