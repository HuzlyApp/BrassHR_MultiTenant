import { NextResponse } from "next/server";
import { JobValidationError } from "@/lib/jobs/types";
import { ServiceAreaDeniedError, TenantWaitlistedError } from "@/lib/service-area/errors";

const SERVICE_AREA_CODES = new Set([
  "platform_hold",
  "outside_hiring_area",
  "incomplete_location",
  "location_not_available",
  "remote_unscoped",
]);

export function isServiceAreaValidationCode(code: string | null | undefined): boolean {
  return Boolean(code && SERVICE_AREA_CODES.has(code));
}

export function serviceAreaDeniedResponse(error: ServiceAreaDeniedError, publicClient = false) {
  return NextResponse.json(error.toJSON(publicClient), { status: 422 });
}

export function tenantWaitlistedResponse(error: TenantWaitlistedError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        messageKey: "signup_waitlist",
        field: "worksite_state",
      },
    },
    { status: 422 }
  );
}

/** Map a job-validation deny onto the §9 envelope. Public apply never receives platform_hold. */
export function jobValidationServiceAreaResponse(
  error: JobValidationError,
  publicClient = false
): NextResponse | null {
  if (!isServiceAreaValidationCode(error.code)) return null;
  const field = Object.keys(error.fieldErrors)[0] || (publicClient ? "work_state" : "worksite_state");
  const messageKey = publicClient
    ? "location_not_available"
    : error.code === "remote_unscoped" || error.code === "platform_hold" || error.code === "outside_hiring_area"
      ? "location_not_enabled"
      : "location_not_available";
  return NextResponse.json(
    {
      error: {
        code: publicClient ? "location_not_available" : error.code,
        messageKey,
        field,
      },
    },
    { status: 422 }
  );
}
