-- Public URLs for SSN / DL back images (front already use ssn_url, drivers_license_url)
ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS ssn_back_url text,
  ADD COLUMN IF NOT EXISTS drivers_license_back_url text;
