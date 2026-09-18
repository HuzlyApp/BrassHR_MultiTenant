-- Phase 1 platform holds were deactivated by disable_service_area_location_holds
-- (Virginia was incorrectly treated as outside a facility-only hiring area).
-- App enforcement is on again; re-enable CA / IL / CT / NYC holds.
-- Tenant hiring-area matching stays off (all_allowed_platform).

UPDATE public.service_area_policies
SET is_active = true
WHERE source = 'platform'
  AND code IN ('CA', 'IL', 'CT', 'NYC')
  AND is_active = false;
