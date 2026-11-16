-- Match main's existing view security mode so callers remain subject to RLS.
ALTER VIEW public.ai_match_progression_prompts SET (security_invoker = true);

