-- Per-tenant Taskboard settings (who may assign worker tasks).

CREATE TABLE IF NOT EXISTS public.tenant_task_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  assign_only_manager_hr boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_task_settings IS
  'Per-tenant Taskboard settings. When assign_only_manager_hr is true, only Manager/HR (and admin) may assign tasks.';

COMMENT ON COLUMN public.tenant_task_settings.assign_only_manager_hr IS
  'When true, only Manager, HR, and Admin roles may assign tasks to workers.';

CREATE INDEX IF NOT EXISTS tenant_task_settings_updated_idx
  ON public.tenant_task_settings (updated_at DESC);

DROP TRIGGER IF EXISTS set_tenant_task_settings_updated_at
  ON public.tenant_task_settings;
CREATE TRIGGER set_tenant_task_settings_updated_at
BEFORE UPDATE ON public.tenant_task_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tenant_task_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_task_settings_staff ON public.tenant_task_settings;
CREATE POLICY tenant_task_settings_staff
  ON public.tenant_task_settings
  FOR ALL TO authenticated
  USING (public.user_is_tenant_staff(tenant_id))
  WITH CHECK (public.user_is_tenant_staff(tenant_id));

REVOKE ALL ON TABLE public.tenant_task_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.tenant_task_settings FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.tenant_task_settings FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_task_settings TO authenticated;
GRANT ALL ON TABLE public.tenant_task_settings TO service_role;

INSERT INTO public.tenant_task_settings (tenant_id, assign_only_manager_hr)
SELECT t.id, true
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_task_settings s
  WHERE s.tenant_id = t.id
);
