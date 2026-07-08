-- Add Carrboro, NC to signup city dropdown options.
INSERT INTO public.signup_us_cities (state_code, city_name, sort_order)
VALUES ('NC', 'Carrboro', 8)
ON CONFLICT (state_code, city_name) DO NOTHING;

-- Keep Cary ahead of Carrboro in sort order when both exist.
UPDATE public.signup_us_cities
SET sort_order = 7
WHERE state_code = 'NC' AND city_name = 'Cary';

UPDATE public.signup_us_cities
SET sort_order = 8
WHERE state_code = 'NC' AND city_name = 'Carrboro';
