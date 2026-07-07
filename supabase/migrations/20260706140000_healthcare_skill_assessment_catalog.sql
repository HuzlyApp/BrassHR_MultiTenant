-- Healthcare staffing skill assessment catalog (8 categories x 5 questions).
-- Idempotent: safe to re-run; matches by category slug and (category_id, quiz_number).

DO $$
DECLARE
  v_category_id uuid;
  v_cat record;
  v_q record;
BEGIN
  FOR v_cat IN
    SELECT *
    FROM (
      VALUES
        (
          'a1000001-0001-4001-8001-000000000001'::uuid,
          'Patient Care Basics',
          'Measures comfort with daily patient care, hygiene, mobility support, and bedside assistance.',
          1,
          'patient-care-basics'
        ),
        (
          'a1000002-0002-4002-8002-000000000002'::uuid,
          'Safety and Infection Control',
          'Measures knowledge of workplace safety, PPE, sanitation, and infection prevention.',
          2,
          'safety-infection-control'
        ),
        (
          'a1000003-0003-4003-8003-000000000003'::uuid,
          'Communication and Documentation',
          'Measures ability to communicate with patients, families, supervisors, and document care accurately.',
          3,
          'communication-documentation'
        ),
        (
          'a1000004-0004-4004-8004-000000000004'::uuid,
          'Medication and Clinical Support',
          'Measures experience with medication reminders, vital signs, and basic clinical support tasks where allowed.',
          4,
          'medication-clinical-support'
        ),
        (
          'a1000005-0005-4005-8005-000000000005'::uuid,
          'Dementia and Behavioral Care',
          'Measures experience working with dementia patients, confused patients, and behavioral situations.',
          5,
          'dementia-behavioral-care'
        ),
        (
          'a1000006-0006-4006-8006-000000000006'::uuid,
          'Facility and Shift Readiness',
          'Measures reliability, attendance, shift preparation, and ability to follow facility expectations.',
          6,
          'facility-shift-readiness'
        ),
        (
          'a1000007-0007-4007-8007-000000000007'::uuid,
          'Emergency Response',
          'Measures comfort responding to emergencies, falls, incidents, and urgent patient needs.',
          7,
          'emergency-response'
        ),
        (
          'a1000008-0008-4008-8008-000000000008'::uuid,
          'Role-Specific Healthcare Skills',
          'Measures role-specific experience for CNA, caregiver, med tech, home health aide, and nursing support roles.',
          8,
          'role-specific-healthcare-skills'
        )
    ) AS t(id, title, description, order_number, slug)
  LOOP
    SELECT sc.id
      INTO v_category_id
    FROM public.skill_categories sc
    WHERE sc.slug = v_cat.slug
    LIMIT 1;

    IF v_category_id IS NULL THEN
      INSERT INTO public.skill_categories (id, title, description, order_number, slug)
      VALUES (v_cat.id, v_cat.title, v_cat.description, v_cat.order_number, v_cat.slug)
      ON CONFLICT (id) DO UPDATE
      SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        order_number = EXCLUDED.order_number,
        slug = EXCLUDED.slug
      RETURNING id INTO v_category_id;
    ELSE
      UPDATE public.skill_categories
      SET
        title = v_cat.title,
        description = v_cat.description,
        order_number = v_cat.order_number
      WHERE id = v_category_id;
    END IF;
  END LOOP;
END $$;

INSERT INTO public.skill_questions (category_id, question, quiz_number)
SELECT c.id, v.question, v.quiz_number
FROM (
  VALUES
    ('patient-care-basics', 1, 'I can assist patients with bathing, grooming, dressing, and hygiene.'),
    ('patient-care-basics', 2, 'I can safely help patients transfer between bed, wheelchair, and chair.'),
    ('patient-care-basics', 3, 'I can assist patients with feeding and hydration needs.'),
    ('patient-care-basics', 4, 'I understand how to provide respectful and compassionate bedside care.'),
    ('patient-care-basics', 5, 'I can identify and report changes in a patient''s condition.'),
    ('safety-infection-control', 1, 'I understand how to properly use gloves, masks, gowns, and other PPE.'),
    ('safety-infection-control', 2, 'I can follow hand hygiene and infection control procedures.'),
    ('safety-infection-control', 3, 'I know how to safely dispose of contaminated materials.'),
    ('safety-infection-control', 4, 'I can recognize safety hazards in a patient care environment.'),
    ('safety-infection-control', 5, 'I understand how to follow facility safety protocols.'),
    ('communication-documentation', 1, 'I can communicate clearly and respectfully with patients and families.'),
    ('communication-documentation', 2, 'I can report patient concerns to nurses or supervisors.'),
    ('communication-documentation', 3, 'I can document completed care tasks accurately.'),
    ('communication-documentation', 4, 'I understand the importance of confidentiality and patient privacy.'),
    ('communication-documentation', 5, 'I can follow written and verbal instructions from facility staff.'),
    ('medication-clinical-support', 1, 'I can take and record basic vital signs.'),
    ('medication-clinical-support', 2, 'I understand the importance of medication timing and reminders.'),
    ('medication-clinical-support', 3, 'I can recognize when a patient may need urgent clinical attention.'),
    ('medication-clinical-support', 4, 'I can support nurses or licensed staff with basic care tasks.'),
    ('medication-clinical-support', 5, 'I understand that medication administration must follow role and license limits.'),
    ('dementia-behavioral-care', 1, 'I have experience assisting patients with dementia or memory loss.'),
    ('dementia-behavioral-care', 2, 'I can remain calm when a patient is confused, upset, or agitated.'),
    ('dementia-behavioral-care', 3, 'I can use redirection techniques when appropriate.'),
    ('dementia-behavioral-care', 4, 'I understand how to prevent escalation during difficult interactions.'),
    ('dementia-behavioral-care', 5, 'I can report behavioral changes to the appropriate staff.'),
    ('facility-shift-readiness', 1, 'I can arrive on time and prepared for assigned shifts.'),
    ('facility-shift-readiness', 2, 'I can follow facility dress code and professional conduct rules.'),
    ('facility-shift-readiness', 3, 'I can adapt to different facility workflows and expectations.'),
    ('facility-shift-readiness', 4, 'I can complete assigned tasks before the end of my shift.'),
    ('facility-shift-readiness', 5, 'I understand the importance of attendance and communication if I cannot work.'),
    ('emergency-response', 1, 'I know what to do if a patient falls.'),
    ('emergency-response', 2, 'I can quickly notify the correct staff during an emergency.'),
    ('emergency-response', 3, 'I understand basic emergency response procedures.'),
    ('emergency-response', 4, 'I can stay calm and follow instructions during urgent situations.'),
    ('emergency-response', 5, 'I know how to report incidents accurately.'),
    ('role-specific-healthcare-skills', 1, 'I have experience performing duties specific to my healthcare role.'),
    ('role-specific-healthcare-skills', 2, 'I understand the limits of what I am allowed to do in my role.'),
    ('role-specific-healthcare-skills', 3, 'I can work under the direction of licensed nurses or supervisors.'),
    ('role-specific-healthcare-skills', 4, 'I can support patients in long-term care, assisted living, or home care settings.'),
    ('role-specific-healthcare-skills', 5, 'I can perform my assigned healthcare tasks safely and professionally.')
) AS v(slug, quiz_number, question)
JOIN public.skill_categories c ON c.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.skill_questions sq
  WHERE sq.category_id = c.id
    AND sq.quiz_number = v.quiz_number
);

UPDATE public.skill_questions sq
SET question = v.question
FROM (
  VALUES
    ('patient-care-basics', 1, 'I can assist patients with bathing, grooming, dressing, and hygiene.'),
    ('patient-care-basics', 2, 'I can safely help patients transfer between bed, wheelchair, and chair.'),
    ('patient-care-basics', 3, 'I can assist patients with feeding and hydration needs.'),
    ('patient-care-basics', 4, 'I understand how to provide respectful and compassionate bedside care.'),
    ('patient-care-basics', 5, 'I can identify and report changes in a patient''s condition.'),
    ('safety-infection-control', 1, 'I understand how to properly use gloves, masks, gowns, and other PPE.'),
    ('safety-infection-control', 2, 'I can follow hand hygiene and infection control procedures.'),
    ('safety-infection-control', 3, 'I know how to safely dispose of contaminated materials.'),
    ('safety-infection-control', 4, 'I can recognize safety hazards in a patient care environment.'),
    ('safety-infection-control', 5, 'I understand how to follow facility safety protocols.'),
    ('communication-documentation', 1, 'I can communicate clearly and respectfully with patients and families.'),
    ('communication-documentation', 2, 'I can report patient concerns to nurses or supervisors.'),
    ('communication-documentation', 3, 'I can document completed care tasks accurately.'),
    ('communication-documentation', 4, 'I understand the importance of confidentiality and patient privacy.'),
    ('communication-documentation', 5, 'I can follow written and verbal instructions from facility staff.'),
    ('medication-clinical-support', 1, 'I can take and record basic vital signs.'),
    ('medication-clinical-support', 2, 'I understand the importance of medication timing and reminders.'),
    ('medication-clinical-support', 3, 'I can recognize when a patient may need urgent clinical attention.'),
    ('medication-clinical-support', 4, 'I can support nurses or licensed staff with basic care tasks.'),
    ('medication-clinical-support', 5, 'I understand that medication administration must follow role and license limits.'),
    ('dementia-behavioral-care', 1, 'I have experience assisting patients with dementia or memory loss.'),
    ('dementia-behavioral-care', 2, 'I can remain calm when a patient is confused, upset, or agitated.'),
    ('dementia-behavioral-care', 3, 'I can use redirection techniques when appropriate.'),
    ('dementia-behavioral-care', 4, 'I understand how to prevent escalation during difficult interactions.'),
    ('dementia-behavioral-care', 5, 'I can report behavioral changes to the appropriate staff.'),
    ('facility-shift-readiness', 1, 'I can arrive on time and prepared for assigned shifts.'),
    ('facility-shift-readiness', 2, 'I can follow facility dress code and professional conduct rules.'),
    ('facility-shift-readiness', 3, 'I can adapt to different facility workflows and expectations.'),
    ('facility-shift-readiness', 4, 'I can complete assigned tasks before the end of my shift.'),
    ('facility-shift-readiness', 5, 'I understand the importance of attendance and communication if I cannot work.'),
    ('emergency-response', 1, 'I know what to do if a patient falls.'),
    ('emergency-response', 2, 'I can quickly notify the correct staff during an emergency.'),
    ('emergency-response', 3, 'I understand basic emergency response procedures.'),
    ('emergency-response', 4, 'I can stay calm and follow instructions during urgent situations.'),
    ('emergency-response', 5, 'I know how to report incidents accurately.'),
    ('role-specific-healthcare-skills', 1, 'I have experience performing duties specific to my healthcare role.'),
    ('role-specific-healthcare-skills', 2, 'I understand the limits of what I am allowed to do in my role.'),
    ('role-specific-healthcare-skills', 3, 'I can work under the direction of licensed nurses or supervisors.'),
    ('role-specific-healthcare-skills', 4, 'I can support patients in long-term care, assisted living, or home care settings.'),
    ('role-specific-healthcare-skills', 5, 'I can perform my assigned healthcare tasks safely and professionally.')
) AS v(slug, quiz_number, question)
JOIN public.skill_categories c ON c.slug = v.slug
WHERE sq.category_id = c.id
  AND sq.quiz_number = v.quiz_number
  AND sq.question IS DISTINCT FROM v.question;
