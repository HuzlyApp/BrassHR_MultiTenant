-- Separate storage for Employee Agreement W2 and I9 Form (legacy worker_documents columns).

ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS agreement_w2_url text,
  ADD COLUMN IF NOT EXISTS agreement_i9_url text;
