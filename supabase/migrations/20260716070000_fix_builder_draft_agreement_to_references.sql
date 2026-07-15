-- Sync onboarding builder canvases with the default workflow change:
-- Agreement / Signature → Add Reference (references-collection).
-- Only remaps flows that still contain the platform-default agreement node id.

UPDATE public.onboarding_flows f
SET
  builder_draft = jsonb_set(
    jsonb_set(
      builder_draft,
      '{nodes}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN node->>'id' = 'step-agreement_signature' THEN
              jsonb_build_object(
                'id', 'step-references',
                'day', COALESCE((node->>'day')::int, 1),
                'label', 'Add Reference',
                'stepId', 'references-collection',
                'position', COALESCE(node->'position', '{"x":120,"y":560}'::jsonb),
                'required', COALESCE((node->>'required')::boolean, true),
                'settings', COALESCE(node->'settings', '{}'::jsonb),
                'description', 'Add professional references for verification'
              )
            ELSE node
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(builder_draft->'nodes') WITH ORDINALITY AS t(node, ord)
      )
    ),
    '{edges}',
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',
            CASE
              WHEN edge->>'id' = 'e-step-authorization_background_check-step-agreement_signature'
                THEN 'e-step-authorization_background_check-step-references'
              WHEN edge->>'id' = 'e-step-agreement_signature-step-review_submit'
                THEN 'e-step-references-step-review_submit'
              ELSE edge->>'id'
            END,
            'source',
            CASE
              WHEN edge->>'source' = 'step-agreement_signature' THEN 'step-references'
              ELSE edge->>'source'
            END,
            'target',
            CASE
              WHEN edge->>'target' = 'step-agreement_signature' THEN 'step-references'
              ELSE edge->>'target'
            END
          )
          ORDER BY ord
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(COALESCE(builder_draft->'edges', '[]'::jsonb)) WITH ORDINALITY AS t(edge, ord)
    )
  ),
  updated_at = now()
WHERE builder_draft->'nodes' @> '[{"id":"step-agreement_signature"}]'::jsonb
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(builder_draft->'nodes') n
    WHERE n->>'id' = 'step-authorization_background_check'
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(builder_draft->'nodes') n
    WHERE n->>'id' = 'step-review_submit'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(builder_draft->'nodes') n
    WHERE n->>'id' = 'step-references'
  );

-- Same remap for legacy drafts stored on tenant_onboarding_configs (if present).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_onboarding_configs'
      AND column_name = 'builder_draft'
  ) THEN
    EXECUTE $sql$
      UPDATE public.tenant_onboarding_configs c
      SET
        builder_draft = jsonb_set(
          jsonb_set(
            builder_draft,
            '{nodes}',
            (
              SELECT jsonb_agg(
                CASE
                  WHEN node->>'id' = 'step-agreement_signature' THEN
                    jsonb_build_object(
                      'id', 'step-references',
                      'day', COALESCE((node->>'day')::int, 1),
                      'label', 'Add Reference',
                      'stepId', 'references-collection',
                      'position', COALESCE(node->'position', '{"x":120,"y":560}'::jsonb),
                      'required', COALESCE((node->>'required')::boolean, true),
                      'settings', COALESCE(node->'settings', '{}'::jsonb),
                      'description', 'Add professional references for verification'
                    )
                  ELSE node
                END
                ORDER BY ord
              )
              FROM jsonb_array_elements(builder_draft->'nodes') WITH ORDINALITY AS t(node, ord)
            )
          ),
          '{edges}',
          (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id',
                  CASE
                    WHEN edge->>'id' = 'e-step-authorization_background_check-step-agreement_signature'
                      THEN 'e-step-authorization_background_check-step-references'
                    WHEN edge->>'id' = 'e-step-agreement_signature-step-review_submit'
                      THEN 'e-step-references-step-review_submit'
                    ELSE edge->>'id'
                  END,
                  'source',
                  CASE
                    WHEN edge->>'source' = 'step-agreement_signature' THEN 'step-references'
                    ELSE edge->>'source'
                  END,
                  'target',
                  CASE
                    WHEN edge->>'target' = 'step-agreement_signature' THEN 'step-references'
                    ELSE edge->>'target'
                  END
                )
                ORDER BY ord
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(COALESCE(builder_draft->'edges', '[]'::jsonb)) WITH ORDINALITY AS t(edge, ord)
          )
        ),
        updated_at = now()
      WHERE builder_draft IS NOT NULL
        AND builder_draft->'nodes' @> '[{"id":"step-agreement_signature"}]'::jsonb
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(builder_draft->'nodes') n
          WHERE n->>'id' = 'step-authorization_background_check'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(builder_draft->'nodes') n
          WHERE n->>'id' = 'step-references'
        )
    $sql$;
  END IF;
END $$;
