-- Point onboarding flow template references at onboarding_templates (not legacy workflow_templates).

ALTER TABLE public.onboarding_flows
  DROP CONSTRAINT IF EXISTS onboarding_flows_template_id_fkey;

UPDATE public.onboarding_flows f
SET template_id = NULL
WHERE f.template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_templates t WHERE t.id = f.template_id
  );

ALTER TABLE public.onboarding_flows
  ADD CONSTRAINT onboarding_flows_template_id_fkey
  FOREIGN KEY (template_id)
  REFERENCES public.onboarding_templates (id)
  ON DELETE SET NULL;
