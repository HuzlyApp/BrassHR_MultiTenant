-- When structured requirement lists are empty, the published candidate_match
-- prompts told the model the JD was "for reference only". That produced
-- Analyzed results with an empty qualification checklist. Instruct the model
-- to extract Required/Preferred qualifications into the scored arrays instead.

DO $$
DECLARE
  src record;
  new_id uuid;
  next_num integer;
  next_system text;
  next_user text;
BEGIN
  FOR src IN
    SELECT
      pv.template_id,
      pv.version_number,
      pv.system_prompt,
      pv.user_prompt_template,
      pv.response_schema,
      pv.model_config
    FROM public.ai_prompt_version pv
    JOIN public.ai_prompt_template t ON t.id = pv.template_id
    JOIN public.ai_feature f ON f.id = t.feature_id
    JOIN public.ai_variant v ON v.id = t.variant_id
    WHERE f.key = 'candidate_match'
      AND v.key IN ('default', 'deep')
      AND pv.is_current = true
  LOOP
    next_num := src.version_number + 1;
    IF EXISTS (
      SELECT 1
      FROM public.ai_prompt_version existing
      WHERE existing.template_id = src.template_id
        AND existing.version_number = next_num
    ) THEN
      CONTINUE;
    END IF;

    next_system := src.system_prompt;
    IF position('REQUIREMENT LISTS' in next_system) = 0 THEN
      next_system := next_system || E'\n\nREQUIREMENT LISTS\n\nAlways return one scored object in mandatory_requirements for every listed mandatory item, and one in preferred_requirements for every listed preferred item. Never return empty arrays when requirements were listed or can be extracted from the job description.\n\nIf the listed mandatory/preferred sections are empty or say they were not listed separately, extract Required Qualifications and Preferred Qualifications from the full job description, then score each extracted item. Put those items in mandatory_requirements / preferred_requirements. Do not put job qualifications only under items_to_verify.';
    END IF;

    next_user := replace(
      src.user_prompt_template,
      'FULL JOB DESCRIPTION (for reference only; requirements above are authoritative)',
      E'FULL JOB DESCRIPTION\nIf the mandatory or preferred lists above are empty or say they were not listed separately, extract Required and Preferred qualifications from this description and score each one in mandatory_requirements / preferred_requirements. Do not leave those arrays empty when the description lists qualifications. Do not put job qualifications only in items_to_verify. If lists were provided, treat them as authoritative.'
    );

    INSERT INTO public.ai_prompt_version (
      template_id,
      version_number,
      status,
      is_current,
      system_prompt,
      user_prompt_template,
      response_schema,
      model_config,
      created_at,
      updated_at
    )
    VALUES (
      src.template_id,
      next_num,
      'draft',
      false,
      next_system,
      next_user,
      src.response_schema,
      src.model_config,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    PERFORM public.publish_ai_prompt_version(
      new_id,
      'Extract job qualifications into the checklist when structured requirement lists are empty'
    );
  END LOOP;
END $$;
