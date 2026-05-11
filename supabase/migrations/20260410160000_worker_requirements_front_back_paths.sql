-- Front/back storage paths for SSN & driver's license (matches step-4 UI)
ALTER TABLE public.worker_requirements
  ADD COLUMN IF NOT EXISTS ssn_card_front_path text,
  ADD COLUMN IF NOT EXISTS ssn_card_back_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_front_path text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_path text;

-- Copy legacy single-column paths into "front" when new columns are empty
UPDATE public.worker_requirements
SET ssn_card_front_path = ssn_card_path
WHERE ssn_card_front_path IS NULL
  AND ssn_card_path IS NOT NULL
  AND trim(ssn_card_path) <> '';

UPDATE public.worker_requirements
SET drivers_license_front_path = drivers_license_path
WHERE drivers_license_front_path IS NULL
  AND drivers_license_path IS NOT NULL
  AND trim(drivers_license_path) <> '';
