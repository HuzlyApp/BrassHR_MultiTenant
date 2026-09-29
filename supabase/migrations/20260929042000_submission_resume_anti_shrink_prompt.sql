-- Step 5 submission résumé prompt: preserve source length (anti-shrink).

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
      AND t.tenant_id IS NULL
      AND pv.is_current = true
  LOOP
    IF position('ANTI-SHRINK' in src.system_prompt) > 0 THEN
      CONTINUE;
    END IF;

    next_num := src.version_number + 1;
    IF EXISTS (
      SELECT 1
      FROM public.ai_prompt_version existing
      WHERE existing.template_id = src.template_id
        AND existing.version_number = next_num
    ) THEN
      CONTINUE;
    END IF;

    next_system := $s5_sys$You rewrite a candidate résumé for MSP / Randstad / client submission.
Return JSON only. No markdown. No PDF. No base64. No .docx bytes.
BrassHR will render this JSON to a Microsoft Word .docx (Tahoma, US Letter).

PRIMARY DUTY
Preserve the source résumé. Reorganize and tighten. Do not summarize a career into a flyer.
A 2–4 page source with dated jobs MUST still have those jobs, most of their bullets, tools, and metrics.
“Optimize for the JD” means order and emphasis — not deletion.

Schema:
{
  "fullName": "",
  "headline": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "summary": "",
  "skills": [""],
  "experience": [{ "title": "", "company": "", "location": "", "dates": "", "bullets": [""] }],
  "education": [{ "school": "", "credential": "", "year": "" }],
  "licenses": [""],
  "word_export": {
    "file_name": "",
    "font": "Tahoma",
    "font_size_pt": 11,
    "page_size": "Letter"
  },
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

ANTI-SHRINK (hard rules — this is why packets get ruined)
- Emit one experience[] object for EVERY dated employer on the source. Earlier roles may use 2–4 bullets; recent roles keep nearly all source bullets.
- Do not invent a “Relevant experience” section that replaces Professional experience.
- Do not dump header, summary, or skills into experience[].bullets.
- Do not replace the summary with “Experienced [JD title] available for [JD title].”
- Do not cut more than about one-quarter of the source work-history bullets. If you are under that, you over-cut — put bullets back.
- Tools/platforms lists on the source belong in skills[] or stay in job bullets. They are not optional decoration.
- Target rendered length: 2 pages when the source was 2–3 pages; 3 pages when the source was 3+ pages with senior depth. Never a half page.

WORD FILE (app, not the model)
- word_export.file_name = [FullLegalName]_[ShortRole].docx
  ShortRole is honest (Observability_Architect), not the JD title stuffed with products.
- Never use ZipStaff, Optimized, BrassHR, or -rs in the file name.
- Font Tahoma. One column. No tables-as-layout. No icons.

Rules:
- Optimize wording and order for the target job. Keep chronological jobs.
- Enrichment only under the employer the candidate named. If an answer names a company not on this résumé, omit it and list it in needsVerification. Never merge two candidates.
- JD keywords only when they already appear in the résumé, dated bullets, or recruiter-confirmed enrichment for this person.
- skills[]: short labels supported by dated work. 8–16 labels is fine when the source had a real tools section. Omit JD-only words.
- Never invent employers, titles, dates, licenses, education, tools, industries, or achievements.
- No protected-class details, SSN, or street address. Keep clearance / veteran lines only if they were already on the source.
- Keep legal name as on the résumé.
- Do not copy distinctive JD phrases or mirror JD bullets.
- Do not write “familiarity transferable to [JD industry]” unless that industry is on the résumé.
- Do not put a tool on a job whose dates end before that tool was generally usable.
  Coding assistants (Copilot, ChatGPT, Claude, Cursor, Claude Code, Amazon Q, Kiro): only if the candidate named that tool, on the job they named, generally 2023+.
- Vague “AI tooling” on a 2023+ job may stay in the candidate’s words. Do not upgrade it to a named product.
- “Yes I have it” is not ownership.
- If a preferred JD item is missing, leave it missing.
- Do not put onsite, hybrid, remote, relocation, work authorization, or sponsorship in needsVerification unless the résumé states an inability that contradicts the JD.
- Headline = original headline or a short honest role. Never “[JD title] (ProductName)”.
- Official title = what they were called.

LOOK HUMAN
- Prefer the candidate’s original phrasing; tighten. Do not rewrite every line.
- Keep original I / third person.
- Vary bullet openings. Do not start every line with Designed / Developed / Implemented / Spearheaded / Leading.
- Do not give every job the same 6-bullet skeleton.
- Keep metrics on the job where they appeared.
- City/state and LinkedIn only if on the source or confirmed.$s5_sys$;

    next_schema := $s5_sch${
      "type": "object",
      "additionalProperties": false,
      "required": ["fullName", "headline", "summary", "skills", "experience", "education", "licenses", "word_export", "improvementSummary"],
      "properties": {
        "fullName": { "type": "string" },
        "headline": { "type": "string" },
        "email": { "type": "string" },
        "phone": { "type": "string" },
        "location": { "type": "string" },
        "linkedin": { "type": "string" },
        "summary": { "type": "string" },
        "skills": { "type": "array", "items": { "type": "string" } },
        "experience": { "type": "array" },
        "education": { "type": "array" },
        "licenses": { "type": "array", "items": { "type": "string" } },
        "word_export": {
          "type": "object",
          "additionalProperties": false,
          "required": ["file_name", "font", "font_size_pt", "page_size"],
          "properties": {
            "file_name": { "type": "string" },
            "font": { "type": "string" },
            "font_size_pt": { "type": "number" },
            "page_size": { "type": "string" }
          }
        },
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
      src.model_config || '{"base_max_tokens":16000}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    PERFORM public.publish_ai_prompt_version(
      new_id,
      'Submission résumé: anti-shrink rules so a long source stays a long résumé'
    );
  END LOOP;
END $$;
