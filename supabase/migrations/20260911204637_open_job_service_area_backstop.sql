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

  -- Match lib/service-area/location-type.ts: spaces/underscores become '-'.
  v_type := lower(btrim(COALESCE(NEW.location_type, NEW.schedule, '')));
  v_type := regexp_replace(v_type, '[\s_]+', '-', 'g');
  v_state := upper(btrim(COALESCE(NEW.worksite_state, '')));
  -- Match lib/service-area/normalize.ts normalizeCityKey.
  v_city := lower(btrim(regexp_replace(COALESCE(NEW.worksite_city, ''), '[^a-zA-Z0-9 .''-]+', '', 'g')));
  v_city := regexp_replace(v_city, '[''.]', '', 'g');
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
    v_city := regexp_replace(v_city, '[''.]', '', 'g');
    v_city := regexp_replace(v_city, '\s+', ' ', 'g');
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
        'new york',
        'new york city',
        'new york, ny',
        'nyc',
        'ny c',
        'city of new york',
        'manhattan',
        'brooklyn',
        'queens',
        'bronx',
        'the bronx',
        'staten island',
        'statenisland',
        'bklyn',
        'bk',
        'astoria',
        'long island city',
        'lic',
        'flushing',
        'jamaica',
        'williamsburg',
        'harlem',
        'east harlem',
        'spanish harlem',
        'upper manhattan',
        'lower manhattan',
        'midtown',
        'midtown manhattan',
        'chelsea',
        'soho',
        'tribeca',
        'greenwich village',
        'east village',
        'west village',
        'upper east side',
        'upper west side',
        'financial district',
        'hells kitchen',
        'washington heights',
        'inwood',
        'morningside heights',
        'chinatown',
        'noho',
        'nolita',
        'flatiron',
        'times square',
        'hudson yards',
        'kips bay',
        'murray hill',
        'gramercy',
        'battery park',
        'battery park city',
        'bushwick',
        'park slope',
        'dumbo',
        'brooklyn heights',
        'bedford stuyvesant',
        'bed stuy',
        'bed-stuy',
        'crown heights',
        'flatbush',
        'greenpoint',
        'fort greene',
        'cobble hill',
        'carroll gardens',
        'red hook',
        'sunset park',
        'bay ridge',
        'bensonhurst',
        'coney island',
        'brighton beach',
        'downtown brooklyn',
        'prospect heights',
        'clinton hill',
        'boerum hill',
        'ditmas park',
        'east new york',
        'brownsville',
        'sheepshead bay',
        'canarsie',
        'windsor terrace',
        'kensington',
        'forest hills',
        'jackson heights',
        'elmhurst',
        'corona',
        'woodside',
        'sunnyside',
        'ridgewood',
        'maspeth',
        'rego park',
        'kew gardens',
        'bayside',
        'whitestone',
        'college point',
        'far rockaway',
        'rockaway',
        'howard beach',
        'ozone park',
        'richmond hill',
        'woodhaven',
        'glendale',
        'middle village',
        'hunters point',
        'dutch kills',
        'ravenswood',
        'east elmhurst',
        'fresh meadows',
        'hollis',
        'briarwood',
        'queens village',
        'springfield gardens',
        'laurelton',
        'rosedale',
        'st albans',
        'saint albans',
        'riverdale',
        'fordham',
        'mott haven',
        'hunts point',
        'soundview',
        'parkchester',
        'throgs neck',
        'throggs neck',
        'city island',
        'co-op city',
        'coop city',
        'pelham bay',
        'kingsbridge',
        'norwood',
        'bedford park',
        'university heights',
        'morrisania',
        'highbridge',
        'south bronx',
        'wakefield',
        'woodlawn',
        'castle hill',
        'st george',
        'saint george',
        'tottenville',
        'great kills',
        'new dorp',
        'port richmond',
        'stapleton',
        'tompkinsville',
        'new springville',
        'eltingville',
        'oakwood',
        'south beach'
      ) THEN
        v_hold := true;
      END IF;
    END IF;

    -- Hybrid jobs also gate remote_allowed_states, matching evaluateServiceArea.
    IF NOT v_hold AND v_type IN ('hybrid', 'remote,-hybrid', 'remote-hybrid') THEN
      v_remote := COALESCE(NEW.remote_allowed_states, ARRAY[]::text[]);
      IF EXISTS (
        SELECT 1
        FROM unnest(v_remote) AS s(code)
        WHERE upper(btrim(code)) IN ('CA', 'IL', 'CT')
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
  'Phase 1 backstop: block open/published jobs in CA, IL, CT, or NYC (including hybrid remote states). Drafts are allowed.';

UPDATE public.service_area_policies
SET cities = ARRAY(
  SELECT DISTINCT lower(btrim(city))
  FROM unnest(
    COALESCE(cities, ARRAY[]::text[]) || ARRAY[
      'new york', 'new york city', 'nyc', 'manhattan', 'brooklyn', 'queens',
      'bronx', 'the bronx', 'staten island', 'astoria', 'flushing', 'jamaica',
      'long island city', 'lic', 'williamsburg', 'harlem', 'east harlem',
      'chelsea', 'soho', 'tribeca', 'hells kitchen', 'greenwich village',
      'east village', 'west village', 'upper east side', 'upper west side',
      'bushwick', 'park slope', 'greenpoint', 'dumbo', 'bedford stuyvesant',
      'bed stuy', 'forest hills', 'jackson heights', 'elmhurst', 'riverdale',
      'fordham', 'st george', 'saint george', 'midtown', 'chinatown', 'noho'
    ]
  ) AS city
  WHERE btrim(city) <> ''
)
WHERE source = 'platform' AND code = 'NYC';
