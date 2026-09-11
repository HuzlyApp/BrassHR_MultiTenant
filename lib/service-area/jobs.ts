import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceAreaMessage } from "@/lib/service-area/copy";
import {
  assertTenantCanOperate,
  evaluateServiceAreaWithDb,
  worksiteFromJobInput,
} from "@/lib/service-area/db";
import { isRemoteJobLocationType } from "@/lib/service-area/location-type";
import { locationFromFreeText } from "@/lib/service-area/normalize";
import type { ServiceAreaDecision, ServiceAreaLocation } from "@/lib/service-area/types";
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
  const message = serviceAreaMessage(decision.messageKey);
  const fieldErrors: FieldErrors = {};
  if (decision.reasonCode === "remote_unscoped") {
    fieldErrors.remoteAllowedStates = message;
  } else {
    fieldErrors.location = message;
  }
  return new JobValidationError(message, fieldErrors, decision.reasonCode);
}

export async function evaluateJobServiceArea(
  supabase: DbClient,
  tenantId: string,
  input: JobRequisitionInput,
  options: { publish: boolean; actorUserId: string; jobId?: string }
): Promise<{ decision: ServiceAreaDecision; warning: string | null; status: "ok" | "blocked" }> {
  if (options.publish) {
    await assertTenantCanOperate(supabase, tenantId);
  }

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
    messageKey: "location_not_available" as const,
    layer: null,
    matchedPolicyId: null,
  };

  const holdDenied =
    decision.reasonCode === "platform_hold" || decision.reasonCode === "outside_hiring_area";
  if (!decision.allowed && (options.publish || holdDenied)) {
    throw decisionToJobError(decision);
  }

  return {
    decision,
    warning: !options.publish && !decision.allowed ? serviceAreaMessage(decision.messageKey) : null,
    status: decision.allowed ? "ok" : "blocked",
  };
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
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    let confirmationQuery = supabase
      .from("work_location_confirmations")
      .select("id, decision")
      .eq("tenant_id", input.tenantId)
      .eq("job_id", input.jobId)
      .eq("decision", "ok")
      .gte("created_at", cutoff);
    if (input.applicantId) {
      confirmationQuery = confirmationQuery.eq("applicant_id", input.applicantId);
    }
    const { data } = await confirmationQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return;
    throw new JobValidationError(
      serviceAreaMessage("location_not_available"),
      { location: serviceAreaMessage("location_not_available") },
      "incomplete_location"
    );
  }

  const decision = await evaluateServiceAreaWithDb(
    supabase,
    {
      tenantId: input.tenantId,
      jobId: input.jobId,
      action: "apply",
      location: input.location,
    },
    { createdBy: input.createdBy }
  );

  const { recordWorkLocationConfirmation } = await import("@/lib/service-area/db");
  await recordWorkLocationConfirmation(supabase, {
    tenantId: input.tenantId,
    jobId: input.jobId,
    applicantId: input.applicantId,
    source: "apply",
    location: input.location,
    decision,
    createdBy: input.createdBy,
  });

  if (!decision.allowed) {
    throw new JobValidationError(
      serviceAreaMessage("location_not_available"),
      { location: serviceAreaMessage("location_not_available") },
      "location_not_available"
    );
  }
}
