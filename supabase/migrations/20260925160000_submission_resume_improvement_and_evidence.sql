-- Strengthen Step 5 submission résumé prompt: improvement summary, anti-stuffing,
-- and enrichment-only-when-supported rules.

DO $$
DECLARE
  src record;
  new_id uuid;
  next_num integer;
  next_system text;
  next_schema jsonb;
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
      AND v.key = 'submission'
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

    next_system := $s5_sys$You rewrite a candidate résumé for MSP / client submission.

Return JSON only. No markdown.

Schema:
{
  "fullName": "",
  "headline": "",
  "email": "",
  "phone": "",
  "location": "",
  "summary": "",
  "skills": [""],
  "experience": [{ "title": "", "company": "", "dates": "", "bullets": [""] }],
  "education": [{ "school": "", "credential": "", "year": "" }],
  "licenses": [""],
  "improvementSummary": {
    "clarity": "",
    "relevance": "",
    "formatting": "",
    "added": [""],
    "removed": [""],
    "needsVerification": [""],
    "overall": ""
  }
}

Rules:
- Optimize wording and order for the target job.
- Put the most relevant experience first.
- Select enrichment (screening answers, call context, verified certifications/skills, follow-up notes) only when it makes the résumé more meaningful for this job. Do not dump every collected detail.
- Use keywords from confirmed requirements only when they already appear in the résumé, Deep Match evidence, or recruiter enrichment.
- Every skills[] label must be supported by work-history bullets, résumé text, or recruiter-confirmed evidence. If a skill is only a JD keyword with no supporting evidence, omit it and mention it under improvementSummary.needsVerification or improvementSummary.removed.
- Prefer a focused Core qualifications list (typically 6–12 short labels). Long unsupported technology dumps are keyword stuffing — omit unsupported items and note that in improvementSummary.
- Prefer recruiter-confirmed facts from Steps 2–4 when they clarify wording already supported by the résumé.
- Never invent employers, titles, dates, licenses, education, tools, proficiency levels, or achievements.
- Do not include protected-class details, SSN, or street address.
- Keep bullets factual and concise.
- skills[] must be short labels (max ~80 characters each), not full requirement sentences.
- If a fact is missing or unconfirmed, omit it and list what must be verified in improvementSummary.needsVerification.
- improvementSummary must briefly cover clarity, relevance, formatting, and what was added or removed.$s5_sys$;

    next_schema := $s5_sch${
      "type": "object",
      "additionalProperties": false,
      "required": ["fullName", "headline", "summary", "skills", "experience", "education", "licenses", "improvementSummary"],
      "properties": {
        "fullName": { "type": "string" },
        "headline": { "type": "string" },
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "location": { "type": "string" },
        "summary": { "type": "string" },
        "skills": { "type": "array", "items": { "type": "string" } },
        "experience": { "type": "array" },
        "education": { "type": "array" },
        "licenses": { "type": "array", "items": { "type": "string" } },
        "improvementSummary": {
          "type": "object",
          "additionalProperties": false,
          "required": ["clarity", "relevance", "formatting", "added", "removed", "needsVerification", "overall"],
          "properties": {
            "clarity": { "type": "string" },
            "relevance": { "type": "string" },
            "formatting": { "type": "string" },
            "added": { "type": "array", "items": { "type": "string" } },
            "removed": { "type": "array", "items": { "type": "string" } },
            "needsVerification": { "type": "array", "items": { "type": "string" } },
            "overall": { "type": "string" }
          }
        }
      }
    }$s5_sch$::jsonb;

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
      next_schema,
      src.model_config,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    PERFORM public.publish_ai_prompt_version(
      new_id,
      'Submission résumé: improvement summary, anti-keyword-stuffing, enrichment selection'
    );
  END LOOP;
END $$;
