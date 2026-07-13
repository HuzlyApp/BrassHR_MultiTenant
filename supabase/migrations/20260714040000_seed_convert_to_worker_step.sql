-- Seed Convert to Worker step for workflow builder library
INSERT INTO public.onboarding_step_library (
  tenant_id, category_id, category_label, step_key, step_type, title, description, icon_key, sort_order
)
SELECT NULL, 'approval-decision', 'Approval & Decision Steps', 'convert-to-worker', 'custom_question',
  'Convert to Worker', 'Staff-only checkpoint that converts an approved applicant into a worker and continues the same workflow.',
  'convert-to-worker', 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_step_library WHERE step_key = 'convert-to-worker' AND tenant_id IS NULL
);
