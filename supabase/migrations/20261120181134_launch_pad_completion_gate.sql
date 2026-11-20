-- Completion is server-owned; browser storage is only a display cache.
CREATE TABLE public.tenant_launch_pad_steps (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_id text NOT NULL CHECK (step_id IN ('logo', 'branding', 'domain', 'preview', 'invite', 'organization')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, step_id)
);

ALTER TABLE public.tenant_launch_pad_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_launch_pad_steps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_launch_pad_steps TO service_role;

COMMENT ON TABLE public.tenant_launch_pad_steps IS
  'Launch Pad tasks confirmed through tenant-admin APIs. All six are required before domain activation.';
