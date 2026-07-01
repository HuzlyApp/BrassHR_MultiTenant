-- US timezone reference data for account settings (editable without app deploy).

CREATE TABLE IF NOT EXISTS public.reference_us_timezones (
  value text NOT NULL,
  label text NOT NULL,
  region text NOT NULL,
  region_sort_order smallint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reference_us_timezones_pkey PRIMARY KEY (value)
);

COMMENT ON TABLE public.reference_us_timezones IS
  'US IANA time zones for account settings dropdowns. Update rows here to change labels or availability.';

CREATE OR REPLACE FUNCTION public.set_reference_us_timezones_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reference_us_timezones_updated_at ON public.reference_us_timezones;
CREATE TRIGGER trg_reference_us_timezones_updated_at
BEFORE UPDATE ON public.reference_us_timezones
FOR EACH ROW
EXECUTE FUNCTION public.set_reference_us_timezones_updated_at();

-- ---------------------------------------------------------------------------
-- Seed all 34 US IANA time zones (safe to re-run)
-- ---------------------------------------------------------------------------
INSERT INTO public.reference_us_timezones (value, label, region, region_sort_order, sort_order, active) VALUES
  ('America/New_York', 'New York', 'Eastern', 1, 1, true),
  ('America/Detroit', 'Detroit, MI', 'Eastern', 1, 2, true),
  ('America/Kentucky/Louisville', 'Louisville, KY', 'Eastern', 1, 3, true),
  ('America/Kentucky/Monticello', 'Monticello, KY', 'Eastern', 1, 4, true),
  ('America/Indiana/Indianapolis', 'Indianapolis, IN', 'Eastern', 1, 5, true),
  ('America/Indiana/Vincennes', 'Vincennes, IN', 'Eastern', 1, 6, true),
  ('America/Indiana/Winamac', 'Winamac, IN', 'Eastern', 1, 7, true),
  ('America/Indiana/Marengo', 'Marengo, IN', 'Eastern', 1, 8, true),
  ('America/Indiana/Petersburg', 'Petersburg, IN', 'Eastern', 1, 9, true),
  ('America/Indiana/Vevay', 'Vevay, IN', 'Eastern', 1, 10, true),
  ('America/Chicago', 'Chicago, IL', 'Central', 2, 11, true),
  ('America/Indiana/Tell_City', 'Tell City, IN', 'Central', 2, 12, true),
  ('America/Indiana/Knox', 'Knox, IN', 'Central', 2, 13, true),
  ('America/Menominee', 'Menominee, MI', 'Central', 2, 14, true),
  ('America/North_Dakota/Center', 'Center, ND', 'Central', 2, 15, true),
  ('America/North_Dakota/New_Salem', 'New Salem, ND', 'Central', 2, 16, true),
  ('America/North_Dakota/Beulah', 'Beulah, ND', 'Central', 2, 17, true),
  ('America/Denver', 'Denver, CO', 'Mountain', 3, 18, true),
  ('America/Boise', 'Boise, ID', 'Mountain', 3, 19, true),
  ('America/Phoenix', 'Phoenix, AZ (no DST)', 'Mountain', 3, 20, true),
  ('America/Los_Angeles', 'Los Angeles, CA', 'Pacific', 4, 21, true),
  ('America/Anchorage', 'Anchorage, AK', 'Alaska', 5, 22, true),
  ('America/Juneau', 'Juneau, AK', 'Alaska', 5, 23, true),
  ('America/Sitka', 'Sitka, AK', 'Alaska', 5, 24, true),
  ('America/Metlakatla', 'Metlakatla, AK', 'Alaska', 5, 25, true),
  ('America/Yakutat', 'Yakutat, AK', 'Alaska', 5, 26, true),
  ('America/Nome', 'Nome, AK', 'Alaska', 5, 27, true),
  ('America/Adak', 'Adak, AK (Aleutian)', 'Alaska', 5, 28, true),
  ('Pacific/Honolulu', 'Honolulu, HI', 'Hawaii', 6, 29, true),
  ('America/Puerto_Rico', 'Puerto Rico', 'US Territories', 7, 30, true),
  ('America/St_Thomas', 'US Virgin Islands', 'US Territories', 7, 31, true),
  ('Pacific/Guam', 'Guam', 'US Territories', 7, 32, true),
  ('Pacific/Saipan', 'Northern Mariana Islands', 'US Territories', 7, 33, true),
  ('Pacific/Pago_Pago', 'American Samoa', 'US Territories', 7, 34, true)
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  region = EXCLUDED.region,
  region_sort_order = EXCLUDED.region_sort_order,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  updated_at = now();

-- Normalize legacy account_settings values before FK
UPDATE public.account_settings
SET timezone = 'America/New_York',
    updated_at = now()
WHERE timezone IS NULL
   OR timezone NOT IN (SELECT value FROM public.reference_us_timezones);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_settings_timezone_fkey'
  ) THEN
    ALTER TABLE public.account_settings
      ADD CONSTRAINT account_settings_timezone_fkey
      FOREIGN KEY (timezone)
      REFERENCES public.reference_us_timezones (value)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.reference_us_timezones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reference_us_timezones_authenticated_read ON public.reference_us_timezones;
CREATE POLICY reference_us_timezones_authenticated_read
  ON public.reference_us_timezones
  FOR SELECT
  TO authenticated
  USING (active = true);

GRANT SELECT ON public.reference_us_timezones TO authenticated;
GRANT ALL ON public.reference_us_timezones TO service_role;
