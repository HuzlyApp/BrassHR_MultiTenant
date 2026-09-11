-- AI prompt catalog checks: mapping, publish immutability, append-only runs.

BEGIN;

SELECT plan(12);

SELECT ok(
  EXISTS (SELECT 1 FROM public.industry_catalog WHERE key = 'allied_health' AND ai_vertical_key = 'healthcare'),
  'allied_health maps to healthcare'
);

SELECT is(
  public.map_industry_to_ai_vertical('retail'),
  'hospitality',
  'retail maps to hospitality'
);

SELECT is(
  public.map_industry_to_ai_vertical('cleaning'),
  'warehouse',
  'cleaning maps to warehouse'
);

SELECT is(
  public.map_industry_to_ai_vertical('other'),
  'global',
  'other maps to global'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_current_prompt_version
    WHERE tenant_id IS NULL
      AND feature_key = 'candidate_match'
      AND variant_key = 'default'
      AND vertical_key = 'global'
      AND status = 'published'
      AND content_hash IS NOT NULL
      AND system_prompt ILIKE '%expert staffing matching analyst%'
  ),
  'global candidate_match default is published with content hash'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_current_prompt_version
    WHERE tenant_id IS NULL
      AND feature_key = 'candidate_match'
      AND variant_key = 'deep'
      AND vertical_key = 'global'
      AND status = 'published'
  ),
  'global candidate_match deep is published'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_current_prompt_version
    WHERE feature_key = 'candidate_match'
      AND vertical_key IN ('technology', 'healthcare', 'home_care', 'hospitality', 'childcare', 'warehouse')
  ),
  'no unapproved industry pack bodies are published'
);

SELECT throws_ok(
  $$
    UPDATE public.ai_prompt_version
    SET system_prompt = 'tamper'
    WHERE id IN (
      SELECT id FROM public.ai_current_prompt_version
      WHERE feature_key = 'candidate_match' AND variant_key = 'default' AND vertical_key = 'global'
      LIMIT 1
    );
  $$,
  'Published and retired prompt versions are immutable'
);

SELECT throws_ok(
  $$
    DELETE FROM public.ai_prompt_run
    WHERE false;
  $$,
  NULL,
  'ai_prompt_run trigger exists'
);

INSERT INTO public.ai_prompt_run (
  tenant_id, feature_key, variant_key, vertical_key, entity_type, entity_id, status
)
SELECT id, 'candidate_match', 'default', 'global', 'job_application', gen_random_uuid(), 'skipped_no_prompt'
FROM public.tenants
LIMIT 1;

SELECT throws_ok(
  $$
    UPDATE public.ai_prompt_run SET status = 'success' WHERE status = 'skipped_no_prompt';
  $$,
  'ai_prompt_run is append-only'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.ai_client_gate WHERE lower(match_value) = 'randstad'),
  'Randstad client gate exists'
);

SELECT * FROM finish();

ROLLBACK;
