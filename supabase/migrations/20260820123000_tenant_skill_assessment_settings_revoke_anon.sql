-- Applicants never query this table directly (service-role API).
-- Default public-schema grants otherwise give anon table privileges.

REVOKE ALL ON TABLE public.tenant_skill_assessment_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.tenant_skill_assessment_settings FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tenant_skill_assessment_settings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_skill_assessment_settings TO authenticated;
GRANT ALL ON TABLE public.tenant_skill_assessment_settings TO service_role;
