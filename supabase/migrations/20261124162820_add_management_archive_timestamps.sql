-- Reversible directory archiving preserves employment, scheduling and billing history.
ALTER TABLE public.facility ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS facility_tenant_archive_idx ON public.facility (tenant_id, archived_at);
CREATE INDEX IF NOT EXISTS workers_tenant_archive_idx ON public.workers (tenant_id, archived_at);
CREATE INDEX IF NOT EXISTS clients_tenant_archive_idx ON public.clients (tenant_id, archived_at);
