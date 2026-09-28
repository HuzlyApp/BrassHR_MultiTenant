-- Step 5 submission résumé prompt: Randstad/MSP wording, Word export metadata,
-- and anti-echo / look-human rules.

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
    IF position('MSP / Randstad / client submission' in src.system_prompt) > 0 THEN
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

WORD FILE (app, not the model)
- word_export.file_name = [FullLegalName]_[ShortRole].docx
  ShortRole is honest (Senior_Data_Engineer), not the JD title stuffed with products.
- Never use ZipStaff, Optimized, BrassHR, or -rs in the file name.
- Font Tahoma. One column. No tables-as-layout. No icons.
- Target 1.5–2 pages when the original had that substance. Do not collapse a detailed résumé into a thin one-pager. Extra jobs can be shorter; do not delete real projects, tools, or metrics to hit a page count.

Rules:
- Optimize wording and order for the target job.
- Put the most relevant experience first. Keep chronological jobs; do not invent a “relevant experience” block that duplicates jobs.
- Select enrichment (screening answers, call notes, confirmed certs/skills) only when it makes this résumé more meaningful for this job. Do not dump every collected field.
- Enrichment may be added only under the employer and dates the candidate named. If an answer names a company that is not on this résumé, omit it and list it in needsVerification. Never merge two candidates.
- Use a JD keyword only when it already appears in the résumé, dated bullets, or recruiter-confirmed enrichment for this person.
- Every skills[] label must be supported by work-history bullets, résumé text, or recruiter-confirmed evidence. JD-only keywords go in needsVerification or removed — not in skills[].
- Prefer 6–12 short Core qualification labels. Long unsupported technology dumps are stuffing.
- Prefer recruiter-confirmed facts when they clarify wording already supported by the résumé.
- Never invent employers, titles, dates, licenses, education, tools, proficiency, industries, or achievements.
- Do not include protected-class details, SSN, or street address.
- Keep legal name as on the résumé. Do not shorten to a nickname unless that is how they signed.
- Keep bullets factual. Prefer the candidate’s nouns (systems, tables, partners, constraints).
- skills[] max ~80 characters each. Not requirement sentences.
- If a fact is missing or unconfirmed, omit it and list it in needsVerification.
- improvementSummary must cover clarity, relevance, formatting, added, removed.
- Do not copy distinctive JD phrases or mirror JD bullets with light word swaps.
  Examples of banned echo: “code generation, debugging, testing, refactoring, and documentation”; “operator copilots / intelligent alarm analysis”; “email file, audience targeting, and campaign management” as one list.
- Do not write “familiarity transferable to [JD industry]” (smart buildings, BAS, marketing CDP, etc.) unless that industry is on the résumé.
- Do not put a tool on a job whose dates end before that tool was generally usable.
  Coding assistants (Copilot, ChatGPT, Claude, Cursor, Claude Code, Amazon Q, Kiro): only on jobs the candidate tied to that tool, generally 2023+. Classic tools follow résumé dates.
- Do not add Copilot, Cursor, ChatGPT, Claude, Amazon Q, or Kiro unless the candidate named that tool.
- “Yes I have it” or awareness is not production ownership. Leave it off or put it in needsVerification.
- If a preferred JD item is missing, leave it missing.
- Do not score or list onsite, hybrid, remote, relocation, work authorization, or sponsorship in needsVerification unless the résumé itself states an inability that contradicts the JD. Those are closed on the recruiter screen.
- Separate product/platform AI features from IDE coding assistants. Do not treat them as the same skill.

LOOK HUMAN (Randstad / MSP)
- Goal: a résumé a person typed. Not an agency template. Not an AI rewrite. Not a JD clone.
- Prefer the candidate’s original phrasing; tighten. Do not rewrite every line.
- Keep the original person (I / third person) unless a line is unreadable.
- Vary bullet length and openings. Do not start every line with Designed / Developed / Implemented / Spearheaded.
- Do not give every job the same 6-bullet skeleton.
- Keep original employers, titles, dates, and metrics. Do not move a metric from Job A onto Job B.
- Official title = what they were called, not the JD title. Do not invent Principal / Architect / Director / Senior Generative AI Engineer.
- Headline is a short honest role (Business Analyst, AI/ML Engineer), not a pipe-separated keyword stack.
- City and state on a job only if the original or the candidate gave it.
- Put LinkedIn in "linkedin" only if it is on the résumé or confirmed.$s5_sys$;

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
      src.model_config,
      now(),
      now()
    )
    RETURNING id INTO new_id;

    PERFORM public.publish_ai_prompt_version(
      new_id,
      'Submission résumé: Randstad/MSP look-human rules and Word export metadata'
    );
  END LOOP;
END $$;
