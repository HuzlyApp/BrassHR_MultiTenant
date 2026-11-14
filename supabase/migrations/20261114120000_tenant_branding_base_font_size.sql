-- Typography base font size for tenant branding (auth / branded surfaces).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS base_font_size text;

COMMENT ON COLUMN public.tenants.base_font_size IS
  'Base font size id for branded surfaces: sm (14px), md (16px), lg (18px).';
