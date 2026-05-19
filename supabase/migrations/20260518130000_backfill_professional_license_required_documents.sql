-- Backfill default professional-license document slots where tenants have the step but no requirements yet.
INSERT INTO public.tenant_required_documents (
  tenant_id, onboarding_step_id, title, description, is_required, sort_order
)
SELECT
  s.tenant_id,
  s.id,
  v.title,
  v.description,
  true,
  v.sort_order
FROM public.tenant_onboarding_steps s
CROSS JOIN (
  VALUES
    ('Nursing License', 'Front and back if applicable', 10),
    ('TB Test', 'Within the last 12 months', 20),
    ('CPR Certifications', NULL, 30)
) AS v(title, description, sort_order)
WHERE s.step_type = 'professional_license'
  AND s.is_enabled = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_required_documents d
    WHERE d.onboarding_step_id = s.id
  );
