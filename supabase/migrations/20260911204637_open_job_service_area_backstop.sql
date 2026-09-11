-- Backstop: refuse open/published jobs whose worksite is on a Phase 1 platform hold.
-- Drafts are not affected. This gate never writes applicant status.

CREATE OR REPLACE FUNCTION public.enforce_open_job_service_area()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_type text;
  v_state text;
  v_city text;
  v_postal text;
  v_remote text[];
  v_hold boolean := false;
BEGIN
  v_status := lower(btrim(COALESCE(NEW.status, '')));
  IF v_status NOT IN ('open', 'published', 'active') THEN
    RETURN NEW;
  END IF;

  v_type := lower(replace(replace(btrim(COALESCE(NEW.location_type, NEW.schedule, '')), ' ', ''), '_', '-'));
  v_state := upper(btrim(COALESCE(NEW.worksite_state, '')));
  v_city := lower(btrim(regexp_replace(COALESCE(NEW.worksite_city, ''), '[^a-zA-Z0-9 .''-]+', '', 'g')));
  v_city := regexp_replace(v_city, '\s+', ' ', 'g');
  v_postal := substring(regexp_replace(COALESCE(NEW.worksite_postal_code, NEW.postal_code, ''), '\D', '', 'g') FROM 1 FOR 5);

  IF v_state = '' AND NEW.location IS NOT NULL THEN
    IF NEW.location ~* '\y(california|ca)\y' THEN v_state := 'CA'; END IF;
    IF NEW.location ~* '\y(illinois|il)\y' THEN v_state := 'IL'; END IF;
    IF NEW.location ~* '\y(connecticut|ct)\y' THEN v_state := 'CT'; END IF;
    IF NEW.location ~* '\y(new york|ny)\y' THEN v_state := 'NY'; END IF;
  END IF;

  IF v_city = '' AND NEW.location IS NOT NULL THEN
    v_city := lower(btrim(split_part(NEW.location, ',', 1)));
  END IF;

  IF v_type IN ('remote') THEN
    v_remote := COALESCE(NEW.remote_allowed_states, ARRAY[]::text[]);
    IF array_length(v_remote, 1) IS NULL THEN
      RAISE EXCEPTION 'This work location isn’t available yet.'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unnest(v_remote) AS s(code)
      WHERE upper(btrim(code)) IN ('CA', 'IL', 'CT')
    ) THEN
      v_hold := true;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.service_area_policies p
      WHERE p.source = 'platform'
        AND p.is_active
        AND p.effect = 'hold'
        AND p.match_type = 'state'
        AND v_state = ANY (SELECT upper(btrim(x)) FROM unnest(p.states) AS x)
    ) THEN
      v_hold := true;
    END IF;

    IF NOT v_hold AND v_state = 'NY' THEN
      IF v_postal <> '' AND EXISTS (
        SELECT 1
        FROM public.service_area_policies p
        JOIN public.service_area_zips z ON z.policy_id = p.id
        WHERE p.source = 'platform'
          AND p.is_active
          AND p.code = 'NYC'
          AND z.postal_code = v_postal
      ) THEN
        v_hold := true;
      END IF;

      IF NOT v_hold AND v_city <> '' AND v_city IN (
        'new york', 'new york city', 'nyc', 'manhattan', 'brooklyn', 'queens',
        'bronx', 'the bronx', 'staten island', 'astoria', 'flushing', 'jamaica',
        'long island city', 'lic', 'williamsburg', 'harlem', 'east harlem',
        'bushwick', 'park slope', 'greenpoint', 'dumbo', 'bedford stuyvesant',
        'bed stuy', 'forest hills', 'jackson heights', 'elmhurst', 'riverdale',
        'fordham', 'st george', 'saint george'
      ) THEN
        v_hold := true;
      END IF;
    END IF;
  END IF;

  IF v_hold THEN
    RAISE EXCEPTION 'This work location isn’t available yet.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_requisitions_open_service_area ON public.job_requisitions;

CREATE TRIGGER job_requisitions_open_service_area
BEFORE INSERT OR UPDATE OF
  status,
  worksite_city,
  worksite_state,
  worksite_postal_code,
  location,
  location_type,
  schedule,
  remote_allowed_states,
  postal_code
ON public.job_requisitions
FOR EACH ROW
WHEN (lower(COALESCE(NEW.status, '')) IN ('open', 'published', 'active'))
EXECUTE FUNCTION public.enforce_open_job_service_area();

COMMENT ON FUNCTION public.enforce_open_job_service_area() IS
  'Phase 1 backstop: block open/published jobs in CA, IL, CT, or NYC. Drafts are allowed.';

UPDATE public.service_area_policies
SET cities = ARRAY(
  SELECT DISTINCT lower(btrim(city))
  FROM unnest(
    COALESCE(cities, ARRAY[]::text[]) || ARRAY[
      'astoria', 'flushing', 'jamaica', 'long island city', 'lic',
      'williamsburg', 'harlem', 'east harlem', 'bushwick', 'park slope',
      'greenpoint', 'dumbo', 'bedford stuyvesant', 'bed stuy',
      'forest hills', 'jackson heights', 'elmhurst', 'riverdale', 'fordham',
      'st george', 'saint george', 'new york', 'new york city', 'nyc',
      'manhattan', 'brooklyn', 'queens', 'bronx', 'the bronx', 'staten island'
    ]
  ) AS city
  WHERE btrim(city) <> ''
)
WHERE source = 'platform' AND code = 'NYC';
