import type { ServiceAreaMessageKey } from "@/lib/service-area/copy";

export const SERVICE_AREA_ACTIONS = [
  "apply",
  "publish_job",
  "attach_candidate",
  "signup",
  "activate_tenant",
  "add_location",
  "update_worker_site",
] as const;

export type ServiceAreaAction = (typeof SERVICE_AREA_ACTIONS)[number];

export const SERVICE_AREA_LOCATION_TYPES = ["onsite", "hybrid", "remote"] as const;
export type ServiceAreaLocationType = (typeof SERVICE_AREA_LOCATION_TYPES)[number];

export const SERVICE_AREA_REASON_CODES = [
  "ok",
  "platform_hold",
  "outside_hiring_area",
  "remote_unscoped",
  "incomplete_location",
  "unknown_location",
] as const;

export type ServiceAreaReasonCode = (typeof SERVICE_AREA_REASON_CODES)[number];

export type ServiceAreaLayer = "platform" | "tenant" | null;

export type ServiceAreaLocation = {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  locationType: ServiceAreaLocationType;
  relocateToJobSite?: boolean;
  remoteAllowedStates?: string[] | null;
};

export type ServiceAreaEvaluateInput = {
  tenantId?: string | null;
  jobId?: string | null;
  action: ServiceAreaAction;
  location: ServiceAreaLocation;
};

export type ServiceAreaPolicy = {
  id: string;
  source: "platform" | "tenant";
  tenantId: string | null;
  code: string;
  label: string;
  matchType: "state" | "city_state" | "postal_prefix" | "zip_list" | "custom";
  states: string[];
  cities: string[];
  postalCodes: string[];
  effect: "hold" | "allow";
  isActive: boolean;
  messageKey: string;
};

export type TenantHiringArea = {
  tenantId: string;
  mode: "locations_only" | "locations_plus_states" | "all_allowed_platform";
  extraAllowedStates: string[];
  /** Active worksites: facilities + primary tenant location. */
  locations: Array<{ city: string; state: string; postalCode?: string | null }>;
};

export type ServiceAreaDecision = {
  allowed: boolean;
  reasonCode: ServiceAreaReasonCode;
  messageKey: ServiceAreaMessageKey;
  layer: ServiceAreaLayer;
  matchedPolicyId: string | null;
};

export type PublicServiceAreaDecision = {
  allowed: boolean;
  reasonCode:
    | "ok"
    | "location_not_available"
    | "incomplete_location"
    | "unknown_location"
    | "remote_unscoped"
    | "opening_unavailable";
  messageKey: ServiceAreaMessageKey;
};

export type JobWorksite = {
  city: string | null;
  state: string | null;
  postalCode: string | null;
  locationType: ServiceAreaLocationType;
  remoteAllowedStates: string[];
  isPublished: boolean;
};

export const ACCOUNT_ACCESS_ACTIVE = "active_trial";
export const ACCOUNT_ACCESS_WAITLIST = "waitlist_pending";
export type TenantAccountAccess = typeof ACCOUNT_ACCESS_ACTIVE | typeof ACCOUNT_ACCESS_WAITLIST;
