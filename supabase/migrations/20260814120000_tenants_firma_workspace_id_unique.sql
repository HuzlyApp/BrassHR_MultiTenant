-- One live Firma workspace per tenant. Partial unique index is idempotent and
-- allows multiple tenants with NULL firma_workspace_id (unprovisioned).

CREATE UNIQUE INDEX IF NOT EXISTS tenants_firma_workspace_id_uidx
  ON public.tenants (firma_workspace_id)
  WHERE firma_workspace_id IS NOT NULL;

COMMENT ON INDEX public.tenants_firma_workspace_id_uidx IS
  'Prevents two tenants from sharing the same Firma workspace id.';
