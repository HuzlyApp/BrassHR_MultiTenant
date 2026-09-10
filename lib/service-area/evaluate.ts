import type { ServiceAreaMessageKey } from "@/lib/service-area/copy";
import { locationMatchesPolicy, hiringLocationMatches } from "@/lib/service-area/match";
import { normalizeRemoteStates, normalizeStateCode } from "@/lib/service-area/normalize";
import type {
  JobWorksite,
  PublicServiceAreaDecision,
  ServiceAreaAction,
  ServiceAreaDecision,
  ServiceAreaLocation,
  ServiceAreaPolicy,
  ServiceAreaReasonCode,
  TenantHiringArea,
} from "@/lib/service-area/types";

export type EvaluateContext = {
  policies: ServiceAreaPolicy[];
  zipListsByPolicyId?: Record<string, Set<string>>;
  hiringArea?: TenantHiringArea | null;
  jobWorksite?: JobWorksite | null;
};

function messageForAction(
  action: ServiceAreaAction,
  reason: ServiceAreaReasonCode
): ServiceAreaMessageKey {
  if (reason === "ok") return "location_not_available";
  if (action === "signup" || action === "activate_tenant") return "signup_waitlist";
  if (action === "apply") return "location_not_available";
  return "location_not_enabled";
}

function ok(): ServiceAreaDecision {
  return {
    allowed: true,
    reasonCode: "ok",
    messageKey: "location_not_available",
    layer: null,
    matchedPolicyId: null,
  };
}

function deny(
  reason: ServiceAreaReasonCode,
  action: ServiceAreaAction,
  layer: ServiceAreaDecision["layer"],
  policyId: string | null
): ServiceAreaDecision {
  return {
    allowed: false,
    reasonCode: reason,
    messageKey: messageForAction(action, reason),
    layer,
    matchedPolicyId: policyId,
  };
}

function resolvedLocation(
  input: ServiceAreaLocation,
  jobWorksite?: JobWorksite | null
): ServiceAreaLocation {
  if (input.relocateToJobSite && jobWorksite) {
    return {
      country: "US",
      city: jobWorksite.city,
      state: jobWorksite.state,
      postalCode: jobWorksite.postalCode,
      locationType: jobWorksite.locationType,
      relocateToJobSite: true,
      remoteAllowedStates: jobWorksite.remoteAllowedStates,
    };
  }
  return input;
}

function isIncompleteOnsite(location: ServiceAreaLocation): boolean {
  if (location.locationType !== "onsite" && location.locationType !== "hybrid") return false;
  const state = normalizeStateCode(location.state);
  const city = String(location.city ?? "").trim();
  return !state || !city;
}

function platformHoldPolicies(policies: ServiceAreaPolicy[]): ServiceAreaPolicy[] {
  return policies.filter(
    (policy) => policy.isActive && policy.source === "platform" && policy.effect === "hold"
  );
}

function matchesHold(
  location: Pick<ServiceAreaLocation, "state" | "city" | "postalCode">,
  policies: ServiceAreaPolicy[],
  zipListsByPolicyId?: Record<string, Set<string>>
): ServiceAreaPolicy | null {
  for (const policy of platformHoldPolicies(policies)) {
    const zips = zipListsByPolicyId?.[policy.id];
    if (locationMatchesPolicy(location, policy, zips)) return policy;
  }
  return null;
}

function evaluateSingleLocation(
  location: Pick<ServiceAreaLocation, "state" | "city" | "postalCode">,
  action: ServiceAreaAction,
  ctx: EvaluateContext
): ServiceAreaDecision {
  const hold = matchesHold(location, ctx.policies, ctx.zipListsByPolicyId);
  if (hold) {
    return deny("platform_hold", action, "platform", hold.id);
  }

  const area = ctx.hiringArea;
  if (!area || area.mode === "all_allowed_platform") return ok();

  const state = normalizeStateCode(location.state);
  const inLocations = area.locations.some((allowed) => hiringLocationMatches(location, allowed));
  if (inLocations) return ok();

  if (area.mode === "locations_plus_states") {
    const extra = new Set(normalizeRemoteStates(area.extraAllowedStates));
    if (state && extra.has(state)) return ok();
  }

  return deny("outside_hiring_area", action, "tenant", null);
}

function evaluateRemoteStates(
  states: string[],
  action: ServiceAreaAction,
  ctx: EvaluateContext
): ServiceAreaDecision {
  const normalized = normalizeRemoteStates(states);
  if (!normalized.length) {
    return deny("remote_unscoped", action, null, null);
  }
  for (const state of normalized) {
    const decision = evaluateSingleLocation(
      { state, city: "", postalCode: "" },
      action,
      ctx
    );
    if (!decision.allowed) return decision;
  }
  return ok();
}

/**
 * Pure decision engine. First failure wins: platform hold → tenant hiring area → allow.
 * Does not log; callers persist denies via recordServiceAreaDecision.
 */
export function evaluateServiceArea(
  input: { action: ServiceAreaAction; location: ServiceAreaLocation },
  ctx: EvaluateContext
): ServiceAreaDecision {
  const location = resolvedLocation(input.location, ctx.jobWorksite);
  const action = input.action;

  if (location.locationType === "remote") {
    const states =
      location.remoteAllowedStates ??
      (normalizeStateCode(location.state) ? [location.state ?? ""] : []);
    if (action === "publish_job" || action === "add_location") {
      return evaluateRemoteStates(states ?? [], action, ctx);
    }
    if (!normalizeStateCode(location.state) && !normalizeRemoteStates(location.remoteAllowedStates).length) {
      return deny("remote_unscoped", action, null, null);
    }
    if (normalizeStateCode(location.state) || String(location.city ?? "").trim()) {
      const direct = evaluateSingleLocation(location, action, ctx);
      if (!direct.allowed) return direct;
    }
    const remoteStates = normalizeRemoteStates(location.remoteAllowedStates);
    if (remoteStates.length) {
      return evaluateRemoteStates(remoteStates, action, ctx);
    }
    return evaluateSingleLocation(location, action, ctx);
  }

  if (isIncompleteOnsite(location)) {
    return deny("incomplete_location", action, null, null);
  }

  if (location.locationType === "hybrid") {
    const onsite = evaluateSingleLocation(location, action, ctx);
    if (!onsite.allowed) return onsite;
    const remoteStates = normalizeRemoteStates(location.remoteAllowedStates);
    if (action === "publish_job" && !remoteStates.length) {
      // Hybrid still requires a worksite; remote states are optional unless provided.
      return onsite;
    }
    if (remoteStates.length) {
      const remote = evaluateRemoteStates(remoteStates, action, ctx);
      if (!remote.allowed) return remote;
    }
    return onsite;
  }

  return evaluateSingleLocation(location, action, ctx);
}

export function toPublicServiceAreaDecision(
  decision: ServiceAreaDecision,
  options?: { openingUnavailable?: boolean }
): PublicServiceAreaDecision {
  if (options?.openingUnavailable) {
    return {
      allowed: false,
      reasonCode: "opening_unavailable",
      messageKey: "opening_unavailable",
    };
  }
  if (decision.allowed) {
    return { allowed: true, reasonCode: "ok", messageKey: decision.messageKey };
  }
  if (decision.reasonCode === "incomplete_location") {
    return {
      allowed: false,
      reasonCode: "incomplete_location",
      messageKey: decision.messageKey,
    };
  }
  if (decision.reasonCode === "remote_unscoped") {
    return {
      allowed: false,
      reasonCode: "remote_unscoped",
      messageKey: decision.messageKey,
    };
  }
  return {
    allowed: false,
    reasonCode: "location_not_available",
    messageKey: "location_not_available",
  };
}

export function fieldForDecision(
  action: ServiceAreaAction,
  decision: ServiceAreaDecision
): string {
  if (action === "signup") return "primary_state";
  if (action === "apply" || action === "attach_candidate") return "work_state";
  if (decision.reasonCode === "remote_unscoped") return "remoteAllowedStates";
  return "worksite_state";
}
