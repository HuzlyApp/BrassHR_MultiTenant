-- Seed global Allied Health specialties for job requisition forms.
INSERT INTO public.specialties (tenant_id, profession_id, code, name)
SELECT NULL, p.id, v.code, v.name
FROM (
  VALUES
    ('PHYSICAL_THERAPY', 'Physical Therapy'),
    ('OCCUPATIONAL_THERAPY', 'Occupational Therapy')
) AS v(code, name)
JOIN public.professions p ON p.tenant_id IS NULL AND p.code = 'ALLIED_HEALTH'
ON CONFLICT DO NOTHING;
