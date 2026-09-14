import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceAreaMessage } from "@/lib/service-area/copy";
import {
  assertTenantCanOperate,
  evaluateServiceAreaWithDb,
  loadJobWorksite,
  recordWorkLocationConfirmation,
  worksiteFromJobInput,
} from "@/lib/service-area/db";
import { isRemoteJobLocationType } from "@/lib/service-area/location-type";
import { locationFromFreeText } from "@/lib/service-area/normalize";
import type { JobWorksite, ServiceAreaDecision, ServiceAreaLocation } from "@/lib/service-area/types";
import { JobValidationError, type FieldErrors, type JobRequisitionInput } from "@/lib/jobs/types";

type DbClient = SupabaseClient;

export function jobInputToServiceAreaLocation(input: JobRequisitionInput): ServiceAreaLocation {
  return worksiteFromJobInput({
    location: input.location || input.facility,
    postalCode: input.postalCode,
    jobLocationType: input.jobLocationType ?? input.schedule,
    remoteAllowedStates: input.remoteAllowedStates,
    worksiteCity: input.worksiteCity,
    worksiteState: input.worksiteState,
    worksitePostalCode: input.worksitePostalCode,
  });
}

function decisionToJobError(decision: ServiceAreaDecision): JobValidationError {
  const message = serviceAreaMessage("location_not_enabled");
  const fieldErrors: FieldErrors = {};
  if (decision.reasonCode === "remote_unscoped") {
    fieldErrors.remoteAllowedStates = message;
  } else {
    fieldErrors.location = message;
  }
  return new JobValidationError(message, fieldErrors, decision.reasonCode);
}

function applyLocationError(code: string = "incomplete_location"): JobValidationError {
  const message = serviceAreaMessage("location_not_enabled");
  return new JobValidationError(message, { location: message }, code);
}

function worksiteToLocation(worksite: JobWorksite): ServiceAreaLocation {
  return {
    country: "US",
    city: worksite.city,
    state: worksite.state,
    postalCode: worksite.postalCode,
    locationType: worksite.locationType,
    remoteAllowedStates: worksite.remoteAllowedStates,
    relocateToJobSite: false,
  };
}

/**
 * Shared live-status gate. Call with publish=true for publish, open, reopen,
 * republish, updates that keep a job open, and bulk open actions.
 * Draft saves must pass publish=false so held worksites warn instead of throw.
 */
export async function evaluateJobServiceArea(
  supabase: DbClient,
  tenantId: string,
  input: JobRequisitionInput,
  options: { publish: boolean; actorUserId: string; jobId?: string }
): Promise<{ decision: ServiceAreaDecision; warning: string | null; status: "ok" | "blocked" }> {
  await assertTenantCanOperate(supabase, tenantId);

  const locations: ServiceAreaLocation[] = [jobInputToServiceAreaLocation(input)];
  if (!isRemoteJobLocationType(input.jobLocationType ?? input.schedule)) {
    for (const extra of input.additionalLocations ?? []) {
      const parsed = locationFromFreeText(extra);
      if (!parsed.city && !parsed.state) continue;
      locations.push({
        country: "US",
        city: parsed.city,
        state: parsed.state,
        postalCode: parsed.postalCode,
        locationType: locations[0]?.locationType ?? "onsite",
      });
    }
  }

  let firstDeny: ServiceAreaDecision | null = null;
  let lastOk: ServiceAreaDecision | null = null;
  for (const location of locations) {
    const decision = await evaluateServiceAreaWithDb(
      supabase,
      {
        tenantId,
        jobId: options.jobId ?? null,
        action: "publish_job",
        location,
      },
      { createdBy: options.actorUserId }
    );
    if (!decision.allowed) {
      firstDeny = decision;
      break;
    }
    lastOk = decision;
  }

  const decision = firstDeny ?? lastOk ?? {
    allowed: true,
    reasonCode: "ok" as const,
    messageKey: "location_not_enabled" as const,
    layer: null,
    matchedPolicyId: null,
  };

  if (!decision.allowed && options.publish) {
    throw decisionToJobError(decision);
  }

  return {
    decision,
    warning: !options.publish && !decision.allowed ? serviceAreaMessage("location_not_enabled") : null,
    status: decision.allowed ? "ok" : "blocked",
  };
}

export async function assertJobServiceAreaForLiveStatus(
  supabase: DbClient,
  tenantId: string,
  input: JobRequisitionInput,
  options: { actorUserId: string; jobId?: string }
) {
  return evaluateJobServiceArea(supabase, tenantId, input, {
    publish: true,
    actorUserId: options.actorUserId,
    jobId: options.jobId,
  });
}

export async function requireApplyWorkLocation(
  supabase: DbClient,
  input: {
    tenantId: string;
    jobId: string;
    applicantId?: string | null;
    createdBy?: string | null;
    location?: ServiceAreaLocation | null;
  }
): Promise<void> {
  if (!input.location) {
    throw applyLocationError("incomplete_location");
  }

  const jobWorksite = await loadJobWorksite(supabase, input.tenantId, input.jobId);
  const relocating = input.location.relocateToJobSite === true;
  const applicantLocation: ServiceAreaLocation = {
    ...input.location,
    relocateToJobSite: relocating,
  };

  let decision: ServiceAreaDecision;

  if (jobWorksite && (jobWorksite.locationType === "onsite" || jobWorksite.locationType === "hybrid")) {
    decision = await evaluateServiceAreaWithDb(
      supabase,
      {
        tenantId: input.tenantId,
        jobId: input.jobId,
        action: "apply",
        location: worksiteToLocation(jobWorksite),
      },
      { createdBy: input.createdBy }
    );
  } else if (jobWorksite?.locationType === "remote") {
    const remoteJob = await evaluateServiceAreaWithDb(
      supabase,
      {
        tenantId: input.tenantId,
        jobId: input.jobId,
        action: "publish_job",
        location: {
          country: "US",
          locationType: "remote",
          remoteAllowedStates: jobWorksite.remoteAllowedStates,
        },
      },
      { createdBy: input.createdBy, skipAudit: true }
    );
    if (!remoteJob.allowed) {
      decision = remoteJob;
    } else {
      decision = await evaluateServiceAreaWithDb(
        supabase,
        {
          tenantId: input.tenantId,
          jobId: input.jobId,
          action: "apply",
          location: { ...applicantLocation, relocateToJobSite: false },
        },
        { createdBy: input.createdBy }
      );
    }
  } else {
    decision = await evaluateServiceAreaWithDb(
      supabase,
      {
        tenantId: input.tenantId,
        jobId: input.jobId,
        action: "apply",
        location: applicantLocation,
      },
      { createdBy: input.createdBy }
    );
  }

  await recordWorkLocationConfirmation(supabase, {
    tenantId: input.tenantId,
    jobId: input.jobId,
    applicantId: input.applicantId ?? null,
    source: "apply",
    location: applicantLocation,
    decision,
    createdBy: input.createdBy,
  });

  if (!decision.allowed) {
    throw applyLocationError(decision.reasonCode);
  }
}
