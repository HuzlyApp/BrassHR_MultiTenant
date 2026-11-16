-- Reuse the existing product category instead of introducing a competing edition.
-- Existing categories were defaulted to Staffing, so require explicit review.
ALTER TABLE public.tenant_categories ADD COLUMN edition_set_at timestamptz;

CREATE TABLE public.edition_features (
  feature_key text PRIMARY KEY CHECK (feature_key ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  smb_default boolean NOT NULL DEFAULT false,
  staffing_default boolean NOT NULL DEFAULT false
);

CREATE TABLE public.tenant_feature_overrides (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.edition_features(feature_key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  notes text CHECK (char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);
CREATE INDEX tenant_feature_overrides_feature_idx ON public.tenant_feature_overrides(feature_key);

INSERT INTO public.edition_features(feature_key, label, description, smb_default, staffing_default) VALUES
  ('manage_clients', 'Manage clients', 'Client management and client columns', false, true),
  ('bill_rates', 'Bill rates', 'Client billing rates', false, true),
  ('multi_client_assignments', 'Multi-client assignments', 'Assign workers across clients', false, true),
  ('internal_scheduling', 'Internal scheduling', 'Schedule the tenant internal workforce', true, true),
  ('timesheets', 'Timesheets', 'Track and review working time', true, true),
  ('hiring_pipeline', 'Hiring pipeline', 'Job requisitions and applicant pipeline', true, true),
  ('hiring_ai', 'Hiring AI', 'Requires separate eligibility review before enabling', false, false);

ALTER TABLE public.edition_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY edition_features_read ON public.edition_features FOR SELECT TO authenticated USING (true);
CREATE POLICY tenant_feature_overrides_read ON public.tenant_feature_overrides
  FOR SELECT TO authenticated USING (
    (SELECT public.is_god_admin_user())
    OR tenant_id = (SELECT public.current_tenant_id())
    OR public.user_is_tenant_staff(tenant_id)
  );

-- Writes go through validated server APIs and the existing module grants.
REVOKE ALL ON public.edition_features, public.tenant_feature_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.edition_features, public.tenant_feature_overrides TO authenticated;
GRANT ALL ON public.edition_features, public.tenant_feature_overrides TO service_role;

CREATE VIEW public.tenant_effective_features WITH (security_invoker = true) AS
SELECT c.tenant_id, lower(c.category) AS edition, f.feature_key,
  coalesce(o.enabled, CASE c.category WHEN 'SMB' THEN f.smb_default ELSE f.staffing_default END) AS enabled
FROM public.tenant_categories c
CROSS JOIN public.edition_features f
LEFT JOIN public.tenant_feature_overrides o ON o.tenant_id = c.tenant_id AND o.feature_key = f.feature_key
WHERE c.edition_set_at IS NOT NULL;
REVOKE ALL ON public.tenant_effective_features FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tenant_effective_features TO authenticated, service_role;

COMMENT ON COLUMN public.tenant_categories.edition_set_at IS
  'Explicit edition classification time. NULL means legacy category has not been reviewed; never mass-backfill from default Staffing values.';
NOTIFY pgrst, 'reload schema';
