-- Restore the existing Phase 1 seed when a project has the schema but no policies.
-- Policy coverage matches 20260910140858; existing tenant policies are untouched.
INSERT INTO public.service_area_policies (
  source, tenant_id, code, label, match_type, states, cities, effect, is_active, message_key
)
SELECT v.source, v.tenant_id, v.code, v.label, v.match_type, v.states, v.cities, v.effect, v.is_active, v.message_key
FROM (
  VALUES
    ('platform', NULL::uuid, 'CA', 'California', 'state', ARRAY['CA']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    ('platform', NULL::uuid, 'IL', 'Illinois', 'state', ARRAY['IL']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    ('platform', NULL, 'CT', 'Connecticut', 'state', ARRAY['CT']::text[], ARRAY[]::text[], 'hold', true, 'location_not_available'),
    (
      'platform',
      NULL,
      'NYC',
      'New York City',
      'city_state',
      ARRAY['NY']::text[],
      ARRAY[
        'new york',
        'new york city',
        'nyc',
        'manhattan',
        'brooklyn',
        'queens',
        'bronx',
        'the bronx',
        'staten island'
      ]::text[],
      'hold',
      true,
      'location_not_available'
    )
) AS v(source, tenant_id, code, label, match_type, states, cities, effect, is_active, message_key)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_area_policies p
  WHERE p.source = 'platform' AND p.code = v.code
);

-- Official five-borough ZIP coverage (unused codes in a range are harmless;
-- Nassau 11001 / 11040 are intentionally excluded).
INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10001, 10007) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10009, 10014) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10016, 10041) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, unnest(ARRAY['10044', '10045', '10055', '10065', '10069', '10075', '10080', '10081'])
FROM public.service_area_policies p
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10101, 10199) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10270, 10286) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10301, 10314) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(10451, 10475) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, unnest(ARRAY['11004', '11005'])
FROM public.service_area_policies p
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11101, 11109) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11201, 11256) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11351, 11385) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11411, 11436) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_area_zips (policy_id, postal_code)
SELECT p.id, lpad(z::text, 5, '0')
FROM public.service_area_policies p
CROSS JOIN generate_series(11691, 11697) AS z
WHERE p.code = 'NYC' AND p.source = 'platform'
ON CONFLICT DO NOTHING;


UPDATE public.service_area_policies SET is_active = true WHERE source = 'platform' AND tenant_id IS NULL AND code IN ('CA', 'IL', 'CT', 'NYC') AND is_active = false;
