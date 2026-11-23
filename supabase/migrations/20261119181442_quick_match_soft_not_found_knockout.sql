-- Step 1 Quick Match: soft NOT_FOUND rows (preferred-worded, physical, logistics)
-- do not count toward the not_found >= 2 knockout. Publishes the next version on
-- every current Global candidate_match / quick master.

DO $$
DECLARE
  src record;
  new_id uuid;
  next_num integer;
  next_system text;
  old_route text :=
    '- LOW_MATCH if any blocker OR core seat is PARTIAL or NOT_FOUND OR weighted <= 0.50 OR confirmed = 0 OR not_found >= 2
- STRONG if no blocker AND weighted >= 0.70 AND mand_met >= 0.60 AND confirmed / M >= 0.50
- Else REVIEW';
  new_route text :=
    'Put preferred-worded JD lines ("preferred", "nice to have", "a plus", "valued") in preferred_requirements, not mandatory.
- LOW_MATCH if any blocker OR core seat is PARTIAL or NOT_FOUND OR weighted <= 0.50 OR confirmed = 0 OR hard not_found >= 2
- hard not_found counts only skill/credential/experience gaps. Preferred-worded, physical ability (lift/stand), and logistics/screening rows do not count toward the not_found >= 2 knockout (SOFT NOT_FOUND KNOCKOUT).
- STRONG if no blocker AND weighted >= 0.70 AND mand_met >= 0.60 AND confirmed / M >= 0.50
- Else REVIEW';
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
      AND v.key = 'quick'
      AND t.tenant_id IS NULL
      AND pv.is_current = true
  LOOP
    IF position('SOFT NOT_FOUND KNOCKOUT' in src.system_prompt) > 0 THEN
      CONTINUE;
    END IF;

    IF position(old_route in src.system_prompt) = 0 THEN
      RAISE NOTICE 'Skipping quick prompt template %: expected ROUTE block not found', src.template_id;
      CONTINUE;
    END IF;

    SELECT coalesce(max(existing.version_number), 0) + 1
      INTO next_num
    FROM public.ai_prompt_version existing
    WHERE existing.template_id = src.template_id;

    next_system := replace(src.system_prompt, old_route, new_route);

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
      src.user_prompt_template,
      src.response_schema,
      src.model_config,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    PERFORM public.publish_ai_prompt_version(
      new_id,
      'Step 1 Quick Match: soft preferred/physical/logistics NOT_FOUND rows do not trigger not_found >= 2 knockout'
    );
  END LOOP;
END $$;
