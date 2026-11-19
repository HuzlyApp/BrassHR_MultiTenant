-- Support admin FAQ management: publish toggle + stable ordering.
ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS faqs_tenant_published_sort_idx
  ON public.faqs (tenant_id, is_published, sort_order, created_at);

COMMENT ON COLUMN public.faqs.sort_order IS 'Display order within category for Help & Knowledgebase.';
COMMENT ON COLUMN public.faqs.is_published IS 'When false, FAQ is hidden from Help views but still editable by staff.';
COMMENT ON COLUMN public.faqs.updated_at IS 'Last staff edit timestamp for FAQ content.';
