-- Stop auto-inserting sample flows; libraries-only seed.
-- Remove previously seeded demo flows so tenants start with real user-created flows only.

CREATE OR REPLACE FUNCTION public.seed_tenant_onboarding_libraries(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.onboarding_libraries (tenant_id, name, slug, is_uncategorized)
  VALUES (p_tenant_id, 'Uncategorized Flows', 'uncategorized', true)
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO public.onboarding_libraries (tenant_id, name, slug)
  VALUES (p_tenant_id, 'Onboarding Flows', 'onboarding')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO public.onboarding_libraries (tenant_id, name, slug)
  VALUES (p_tenant_id, 'Marketing Flows', 'marketing')
  ON CONFLICT (tenant_id, slug) DO UPDATE SET name = EXCLUDED.name;
END;
$$;

-- Remove demo flows that were inserted by the original seed (blank canvas, no user owner).
DELETE FROM public.onboarding_flows
WHERE created_as_blank = true
  AND builder_draft = '{"nodes":[],"edges":[]}'::jsonb
  AND lower(trim(name)) IN (
    lower('Pre-Offer (ATS)'),
    lower('Post-Offer'),
    lower('Final Offer'),
    lower('Employee Account Setup'),
    lower('New Hire Orientation'),
    lower('HR Document Verification'),
    lower('IT Equipment Provisioning'),
    lower('Payroll Enrollment'),
    lower('Background Check Approval'),
    lower('Department Introduction'),
    lower('Training & Compliance'),
    lower('Benefits Registration'),
    lower('Manager Approval'),
    lower('Facility Assignment')
  );
