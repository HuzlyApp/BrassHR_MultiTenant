-- Persist a human-readable support ticket number (e.g. 23-F5B18).
-- Display layer adds the leading "#".

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_number text;

-- Derive from UUID the same way the UI previously did: first 7 hex chars as XX-XXXXX.
UPDATE public.support_tickets
SET ticket_number =
  upper(substr(replace(id::text, '-', ''), 1, 2))
  || '-'
  || upper(substr(replace(id::text, '-', ''), 3, 5))
WHERE ticket_number IS NULL
   OR btrim(ticket_number) = '';

ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_tenant_ticket_number_uidx
  ON public.support_tickets (tenant_id, ticket_number);

CREATE OR REPLACE FUNCTION public.set_support_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  compact text;
BEGIN
  IF NEW.ticket_number IS NULL OR btrim(NEW.ticket_number) = '' THEN
    compact := upper(substr(replace(NEW.id::text, '-', ''), 1, 7));
    IF char_length(compact) < 3 THEN
      NEW.ticket_number := upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
    ELSE
      NEW.ticket_number := substr(compact, 1, 2) || '-' || substr(compact, 3);
    END IF;
  ELSE
    NEW.ticket_number := upper(btrim(NEW.ticket_number));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_set_ticket_number ON public.support_tickets;
CREATE TRIGGER support_tickets_set_ticket_number
  BEFORE INSERT OR UPDATE OF ticket_number ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_support_ticket_number();

COMMENT ON COLUMN public.support_tickets.ticket_number IS
  'Human-readable ticket reference stored without leading # (e.g. 23-F5B18).';
