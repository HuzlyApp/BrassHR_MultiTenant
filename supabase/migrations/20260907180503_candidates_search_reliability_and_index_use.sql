-- Phone digits expression index for normalized phone search.
-- (RPC body updated in candidates_search_rpc_trigram_match.)

CREATE INDEX IF NOT EXISTS worker_phone_digits_idx
  ON public.worker (
    tenant_id,
    (regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
  )
  WHERE coalesce(phone, '') <> '';
