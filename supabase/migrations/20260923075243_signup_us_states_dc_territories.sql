-- Add DC + US territories to signup_us_states (50 → 55).
-- Safe to re-run: ON CONFLICT DO NOTHING.

INSERT INTO public.signup_us_states (code, name, sort_order) VALUES
  ('AS', 'American Samoa', 51),
  ('DC', 'District of Columbia', 52),
  ('GU', 'Guam', 53),
  ('PR', 'Puerto Rico', 54),
  ('VI', 'U.S. Virgin Islands', 55)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.signup_us_states IS
  'US states, DC, and territories for Braas HR dropdowns (55 entries).';
