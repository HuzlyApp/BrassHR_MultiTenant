import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceAreaMessage } from "@/lib/service-area/copy";
import { evaluateServiceArea, fieldForDecision, toPublicServiceAreaDecision } from "@/lib/service-area/evaluate";
import { ServiceAreaDeniedError, TenantWaitlistedError } from "@/lib/service-area/errors";
import { normalizeServiceAreaLocationType } from "@/lib/service-area/location-type";
import { locationFromFreeText, normalizeRemoteStates, normalizeStateCode } from "@/lib/service-area/normalize";
import type {
  JobWorksite,
  PublicServiceAreaDecision,
  ServiceAreaAction,
  ServiceAreaDecision,
  ServiceAreaEvaluateInput,
  ServiceAreaLocation,
  ServiceAreaPolicy,
  TenantHiringArea,
} from "@/lib/service-area/types";
import { ACCOUNT_ACCESS_WAITLIST } from "@/lib/service-area/types";

type DbClient = SupabaseClient;

type PolicyRow = {
  id: string;
  source: "platform" | "tenant";
  tenant_id: string | null;
  code: string;
  label: string;
  match_type: ServiceAreaPolicy["matchType"];
  states: string[] | null;
  cities: string[] | null;
  postal_codes: string[] | null;
  effect: "hold" | "allow";
  is_active: boolean;
  message_key: string;
};

function toPolicy(row: PolicyRow, extraZips: string[]): ServiceAreaPolicy {
  return {
    id: row.id,
    source: row.source,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    matchType: row.match_type,
    states: row.states ?? [],
    cities: row.cities ?? [],
    postalCodes: [...(row.postal_codes ?? []), ...extraZips],
    effect: row.effect,
    isActive: row.is_active,
    messageKey: row.message_key,
  };
}

export async function loadPlatformPolicies(supabase: DbClient): Promise<{
  policies: ServiceAreaPolicy[];
  zipListsByPolicyId: Record<string, Set<string>>;
}> {
  const { data: rows, error } = await supabase
    .from("service_area_policies")
    .select(
      "id, source, tenant_id, code, label, match_type, states, cities, postal_codes, effect, is_active, message_key"
    )
    .eq("source", "platform")
    .eq("is_active", true);
  if (error) throw error;

  const policiesRaw = (rows ?? []) as PolicyRow[];
  const ids = policiesRaw.map((row) => row.id);
  const zipListsByPolicyId: Record<string, Set<string>> = {};

  if (ids.length) {
    const { data: zipRows, error: zipError } = await supabase
      .from("service_area_zips")
      .select("policy_id, postal_code")
      .in("policy_id", ids);
    if (zipError) throw zipError;
    for (const zip of zipRows ?? []) {
      const policyId = String(zip.policy_id);
      const code = String(zip.postal_code ?? "").trim();
      if (!code) continue;
      if (!zipListsByPolicyId[policyId]) zipListsByPolicyId[policyId] = new Set();
      zipListsByPolicyId[policyId].add(code);
    }
  }

  const policies = policiesRaw.map((row) =>
    toPolicy(row, Array.from(zipListsByPolicyId[row.id] ?? []))
  );

  return { policies, zipListsByPolicyId };
}

export async function loadTenantHiringArea(
  supabase: DbClient,
  tenantId: string
): Promise<TenantHiringArea> {
  const [{ data: areaRow, error: areaError }, { data: tenant, error: tenantError }, { data: facilities, error: facilityError }] =
    await Promise.all([
      supabase
        .from("tenant_hiring_areas")
        .select("tenant_id, mode, extra_allowed_states")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("city, state, postal_code, primary_city, primary_state, primary_postal_code")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase.from("facility").select("address").eq("tenant_id", tenantId),
    ]);
  if (areaError) throw areaError;
  if (tenantError) throw tenantError;
  if (facilityError) throw facilityError;

  const locations: TenantHiringArea["locations"] = [];
  const seen = new Set<string>();

  function addLocation(city: string, state: string, postalCode?: string | null) {
    const parsed = locationFromFreeText(
      [city, state].filter(Boolean).join(", "),
      postalCode
    );
    const resolvedState = parsed.state || normalizeStateCode(state);
    const resolvedCity = parsed.city || city.trim();
    if (!resolvedState && !resolvedCity) return;
    const key = `${resolvedCity.toLowerCase()}|${resolvedState}|${parsed.postalCode}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push({
      city: resolvedCity,
      state: resolvedState,
      postalCode: parsed.postalCode || postalCode || null,
    });
  }

  if (tenant) {
    addLocation(
      String(tenant.primary_city ?? tenant.city ?? ""),
      String(tenant.primary_state ?? tenant.state ?? ""),
      tenant.primary_postal_code ?? tenant.postal_code
    );
  }

  for (const row of facilities ?? []) {
    const parsed = locationFromFreeText(row.address ? String(row.address) : "");
    if (parsed.city || parsed.state) {
      addLocation(parsed.city, parsed.state, parsed.postalCode);
    }
  }

  const storedMode = areaRow?.mode as TenantHiringArea["mode"] | undefined;
  const mode: TenantHiringArea["mode"] =
    storedMode ?? "all_allowed_platform";

  return {
    tenantId,
    mode,
    extraAllowedStates: normalizeRemoteStates(
      (areaRow?.extra_allowed_states as string[] | null) ?? []
    ),
    locations,
  };
}

export async function loadJobWorksite(
  supabase: DbClient,
  tenantId: string,
  jobId: string
): Promise<JobWorksite | null> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select(
      "worksite_city, worksite_state, worksite_postal_code, location, postal_code, location_type, schedule, remote_allowed_states, status"
    )
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const fromColumns = {
    city: data.worksite_city ? String(data.worksite_city) : "",
    state: data.worksite_state ? String(data.worksite_state) : "",
    postalCode: data.worksite_postal_code ? String(data.worksite_postal_code) : "",
  };
  const parsed = locationFromFreeText(
    String(data.location ?? ""),
    data.postal_code ? String(data.postal_code) : fromColumns.postalCode
  );
  const locationType =
    normalizeServiceAreaLocationType(String(data.location_type ?? data.schedule ?? "")) ?? "onsite";
  const status = String(data.status ?? "").toLowerCase();

  return {
    city: fromColumns.city || parsed.city || null,
    state: fromColumns.state || parsed.state || null,
    postalCode: fromColumns.postalCode || parsed.postalCode || null,
    locationType,
    remoteAllowedStates: normalizeRemoteStates(
      (data.remote_allowed_states as string[] | null) ?? []
    ),
    isPublished: status === "open" || status === "published",
  };
}

export async function recordServiceAreaDecision(
  supabase: DbClient,
  input: {
    tenantId?: string | null;
    jobId?: string | null;
    action: ServiceAreaAction;
    location: ServiceAreaLocation;
    decision: ServiceAreaDecision;
    createdBy?: string | null;
  }
): Promise<void> {
  if (input.decision.allowed) return;
  const { error } = await supabase.from("service_area_decisions").insert({
    tenant_id: input.tenantId ?? null,
    job_id: input.jobId ?? null,
    action: input.action,
    work_city: input.location.city ?? null,
    work_state: normalizeStateCode(input.location.state) || input.location.state || null,
    work_postal_code: input.location.postalCode ?? null,
    location_type: input.location.locationType,
    relocate_to_job_site: Boolean(input.location.relocateToJobSite),
    allowed: false,
    reason_code: input.decision.reasonCode,
    message_key: input.decision.messageKey,
    layer: input.decision.layer,
    policy_id: input.decision.matchedPolicyId,
    created_by: input.createdBy ?? null,
  });
  if (error) {
    console.error("[service-area] failed to record decision", error.message);
  }
}

export async function recordWorkLocationConfirmation(
  supabase: DbClient,
  input: {
    tenantId: string;
    jobId?: string | null;
    applicantId?: string | null;
    source: "apply" | "recruiter_upload" | "signup" | "add_location" | "worker_move";
    home?: { city?: string | null; state?: string | null; postalCode?: string | null };
    location: ServiceAreaLocation;
    decision: ServiceAreaDecision;
    createdBy?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("work_location_confirmations").insert({
    tenant_id: input.tenantId,
    job_id: input.jobId ?? null,
    applicant_id: input.applicantId ?? null,
    source: input.source,
    home_city: input.home?.city ?? null,
    home_state: input.home?.state ?? null,
    home_postal_code: input.home?.postalCode ?? null,
    work_city: input.location.city ?? null,
    work_state: normalizeStateCode(input.location.state) || input.location.state || null,
    work_postal_code: input.location.postalCode ?? null,
    location_type: input.location.locationType,
    relocate_to_job_site: Boolean(input.location.relocateToJobSite),
    decision: input.decision.allowed ? "ok" : input.decision.reasonCode,
    reason_code: input.decision.reasonCode,
    message_key: input.decision.messageKey,
    policy_id: input.decision.matchedPolicyId,
    created_by: input.createdBy ?? null,
  });
  if (error) {
    console.error("[service-area] failed to record confirmation", error.message);
  }
}

export async function insertServiceAreaWaitlist(
  supabase: DbClient,
  input: {
    email: string;
    city?: string | null;
    state?: string | null;
    source: "apply" | "signup";
    tenantId?: string | null;
    jobId?: string | null;
  }
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const { error } = await supabase.from("service_area_waitlist").insert({
    email,
    city: input.city ?? null,
    state: input.state ?? null,
    source: input.source,
    tenant_id: input.tenantId ?? null,
    job_id: input.jobId ?? null,
  });
  if (error) {
    console.error("[service-area] failed to insert waitlist", error.message);
  }
}

export async function loadTenantAccountAccess(
  supabase: DbClient,
  tenantId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("tenants")
    .select("account_access")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return String(data?.account_access ?? "active_trial");
}

export async function assertTenantCanOperate(
  supabase: DbClient,
  tenantId: string
): Promise<void> {
  const access = await loadTenantAccountAccess(supabase, tenantId);
  if (access === ACCOUNT_ACCESS_WAITLIST) {
    throw new TenantWaitlistedError();
  }
}

export async function evaluateServiceAreaWithDb(
  supabase: DbClient,
  input: ServiceAreaEvaluateInput,
  options?: { createdBy?: string | null; skipAudit?: boolean }
): Promise<ServiceAreaDecision> {
  const [{ policies, zipListsByPolicyId }, hiringArea, jobWorksite] = await Promise.all([
    loadPlatformPolicies(supabase),
    input.tenantId ? loadTenantHiringArea(supabase, input.tenantId) : Promise.resolve(null),
    input.tenantId && input.jobId
      ? loadJobWorksite(supabase, input.tenantId, input.jobId)
      : Promise.resolve(null),
  ]);

  const decision = evaluateServiceArea(
    { action: input.action, location: input.location },
    { policies, zipListsByPolicyId, hiringArea, jobWorksite }
  );

  if (!options?.skipAudit) {
    await recordServiceAreaDecision(supabase, {
      tenantId: input.tenantId,
      jobId: input.jobId,
      action: input.action,
      location: input.location,
      decision,
      createdBy: options?.createdBy,
    });
  }

  return decision;
}

export function deniedErrorFromDecision(
  action: ServiceAreaAction,
  decision: ServiceAreaDecision,
  publicClient = false
): ServiceAreaDeniedError {
  const publicDecision = publicClient ? toPublicServiceAreaDecision(decision) : null;
  return new ServiceAreaDeniedError({
    code: publicClient ? publicDecision!.reasonCode : decision.reasonCode,
    messageKey: publicClient ? publicDecision!.messageKey : decision.messageKey,
    field: fieldForDecision(action, decision),
    publicMessage: serviceAreaMessage(
      publicClient ? publicDecision!.messageKey : decision.messageKey
    ),
  });
}

export function toPublicEvaluateResponse(
  decision: ServiceAreaDecision,
  openingUnavailable = false
): PublicServiceAreaDecision {
  return toPublicServiceAreaDecision(decision, { openingUnavailable });
}

export function worksiteFromJobInput(input: {
  location?: string | null;
  postalCode?: string | null;
  jobLocationType?: string | null;
  remoteAllowedStates?: string[] | null;
  worksiteCity?: string | null;
  worksiteState?: string | null;
  worksitePostalCode?: string | null;
}): ServiceAreaLocation {
  const parsed = locationFromFreeText(input.location, input.postalCode);
  const locationType =
    normalizeServiceAreaLocationType(input.jobLocationType) ?? "onsite";
  return {
    country: "US",
    city: input.worksiteCity?.trim() || parsed.city,
    state: input.worksiteState?.trim() || parsed.state,
    postalCode: input.worksitePostalCode?.trim() || parsed.postalCode,
    locationType,
    remoteAllowedStates: normalizeRemoteStates(input.remoteAllowedStates),
  };
}
