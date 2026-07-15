import {
  EMPLOYMENT_TYPES,
  JOB_SOURCE_TYPES,
  LOCATION_TYPES,
  PLACEMENT_TYPES,
  RATE_UNITS,
  type EmploymentType,
  type JobSourceType,
  type LocationType,
  type PlacementType,
  type RateUnit,
} from "@/lib/job-requisitions/types";

export type JobValidationIssue = {
  field: string;
  section: string;
  message: string;
};

export type JobValidationInput = {
  title?: string | null;
  status?: string | null;
  employmentType?: string | null;
  placementType?: string | null;
  sourceType?: string | null;
  profession?: string | null;
  specialty?: string | null;
  jobRole?: string | null;
  locationType?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  mspId?: string | null;
  mspName?: string | null;
  externalReqId?: string | null;
  sourceJobUrl?: string | null;
  eorTenantId?: string | null;
  positionsCount?: number | null;
  payRate?: number | null;
  billRate?: number | null;
  rateUnit?: string | null;
  workflowTemplateId?: string | null;
  forPublish?: boolean;
};

function includes<T extends string>(list: readonly T[], value: string | null | undefined): value is T {
  return !!value && (list as readonly string[]).includes(value);
}

export function deriveSourceType(
  placementType: string | null | undefined,
  sourceType?: string | null
): JobSourceType {
  if (includes(JOB_SOURCE_TYPES, sourceType ?? null)) {
    return sourceType as JobSourceType;
  }
  return placementType === "Internal" ? "Internal" : "MSP";
}

export function isValidSourceUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Clear stale conditional fields before persistence. */
export function sanitizeConditionalJobFields(input: {
  sourceType: JobSourceType;
  placementType: PlacementType;
  locationType?: LocationType | null;
  mspId?: string | null;
  mspName?: string | null;
  mspClientId?: string | null;
  mspClientName?: string | null;
  externalReqId?: string | null;
  sourceJobTitle?: string | null;
  sourceJobUrl?: string | null;
  sourceJobDetails?: string | null;
  eorTenantId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const isMsp = input.sourceType === "MSP";
  const isEor = input.placementType === "Recruit_and_EOR";
  const isRemote = input.locationType === "Remote";

  return {
    msp_id: isMsp ? input.mspId ?? null : null,
    msp_name: isMsp ? input.mspName?.trim() || null : null,
    msp_client_id: isMsp ? input.mspClientId ?? null : null,
    msp_client_name: isMsp ? input.mspClientName?.trim() || null : null,
    external_req_id: isMsp ? input.externalReqId?.trim() || null : null,
    source_job_title: isMsp ? input.sourceJobTitle?.trim() || null : null,
    source_job_url: isMsp ? input.sourceJobUrl?.trim() || null : null,
    source_job_details: isMsp ? input.sourceJobDetails?.trim() || null : null,
    eor_tenant_id: isEor ? input.eorTenantId ?? null : null,
    address_line1: isRemote ? null : input.addressLine1?.trim() || null,
    address_line2: isRemote ? null : input.addressLine2?.trim() || null,
    city: input.city?.trim() || null,
    state_province: input.stateProvince?.trim() || null,
    postal_code: isRemote ? input.postalCode?.trim() || null : input.postalCode?.trim() || null,
    country: input.country?.trim() || null,
    latitude: isRemote ? null : input.latitude ?? null,
    longitude: isRemote ? null : input.longitude ?? null,
  };
}

export function validateJobRequisition(
  input: JobValidationInput
): { ok: true } | { ok: false; issues: JobValidationIssue[] } {
  const issues: JobValidationIssue[] = [];
  const forPublish = input.forPublish === true;
  const title = input.title?.trim() ?? "";
  const employmentType = input.employmentType ?? null;
  const placementType = input.placementType ?? null;
  const sourceType = deriveSourceType(placementType, input.sourceType);
  const profession = (input.profession ?? input.jobRole)?.trim() || null;

  if (!title) {
    issues.push({
      field: "title",
      section: "Basic Information",
      message: "Job title is required.",
    });
  }

  if (!includes(EMPLOYMENT_TYPES, employmentType)) {
    issues.push({
      field: "employmentType",
      section: "Employment and Placement",
      message: "Employment type must be W2, 1099, or Contract.",
    });
  }

  if (!includes(PLACEMENT_TYPES, placementType)) {
    issues.push({
      field: "placementType",
      section: "Employment and Placement",
      message: "Placement type is required.",
    });
  } else if (sourceType === "Internal" && placementType !== "Internal") {
    issues.push({
      field: "placementType",
      section: "Employment and Placement",
      message: "Internal jobs must use Internal placement.",
    });
  } else if (
    sourceType === "MSP" &&
    placementType !== "Recruit_and_Release" &&
    placementType !== "Recruit_and_EOR"
  ) {
    issues.push({
      field: "placementType",
      section: "Employment and Placement",
      message: "MSP jobs must use Recruit and Release or Recruit and EOR.",
    });
  }

  if (input.locationType && !includes(LOCATION_TYPES, input.locationType)) {
    issues.push({
      field: "locationType",
      section: "Location",
      message: "Location type must be On-site, Remote, or Hybrid.",
    });
  }

  if (input.rateUnit && !includes(RATE_UNITS, input.rateUnit)) {
    issues.push({
      field: "rateUnit",
      section: "Compensation",
      message: "Rate unit is invalid.",
    });
  }

  if (input.positionsCount != null && input.positionsCount < 1) {
    issues.push({
      field: "positionsCount",
      section: "Basic Information",
      message: "Number of positions must be at least 1.",
    });
  }

  if (input.payRate != null && input.payRate < 0) {
    issues.push({
      field: "payRate",
      section: "Compensation",
      message: "Pay rate cannot be negative.",
    });
  }

  if (input.billRate != null && input.billRate < 0) {
    issues.push({
      field: "billRate",
      section: "Compensation",
      message: "Bill rate cannot be negative.",
    });
  }

  if (input.sourceJobUrl && !isValidSourceUrl(input.sourceJobUrl)) {
    issues.push({
      field: "sourceJobUrl",
      section: "MSP Source Details",
      message: "Source job URL must be a valid http(s) URL.",
    });
  }

  if (forPublish) {
    if (!profession) {
      issues.push({
        field: "profession",
        section: "Profession and Specialty",
        message: "Profession is required before publishing.",
      });
    }

    if (sourceType === "MSP") {
      if (!input.mspId && !input.mspName?.trim()) {
        issues.push({
          field: "mspId",
          section: "MSP Source Details",
          message: "MSP is required for MSP jobs before publishing.",
        });
      }
      if (!input.externalReqId?.trim()) {
        issues.push({
          field: "externalReqId",
          section: "MSP Source Details",
          message: "Source Job Requisition Number is required before publishing.",
        });
      }
    }

    if (placementType === "Recruit_and_EOR" && !input.eorTenantId) {
      issues.push({
        field: "eorTenantId",
        section: "Employment and Placement",
        message: "Employer of Record is required for Recruit and EOR jobs.",
      });
    }

    if (
      (input.locationType === "On-site" || input.locationType === "Hybrid") &&
      !input.addressLine1?.trim() &&
      !input.city?.trim()
    ) {
      issues.push({
        field: "addressLine1",
        section: "Location",
        message: "A location or address is required for on-site and hybrid jobs.",
      });
    }

    if (!input.workflowTemplateId) {
      issues.push({
        field: "workflowTemplateId",
        section: "Workflow Assignment",
        message: "A workflow must be resolved before publishing.",
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true };
}

export function parseEmploymentType(value: unknown): EmploymentType | null {
  const v = typeof value === "string" ? value.trim() : "";
  return includes(EMPLOYMENT_TYPES, v) ? v : null;
}

export function parsePlacementType(value: unknown): PlacementType | null {
  const v = typeof value === "string" ? value.trim() : "";
  return includes(PLACEMENT_TYPES, v) ? v : null;
}

export function parseLocationType(value: unknown): LocationType | null {
  const v = typeof value === "string" ? value.trim() : "";
  return includes(LOCATION_TYPES, v) ? v : null;
}

export function parseRateUnit(value: unknown): RateUnit | null {
  const v = typeof value === "string" ? value.trim() : "";
  return includes(RATE_UNITS, v) ? v : null;
}

export function parseSourceType(value: unknown): JobSourceType | null {
  const v = typeof value === "string" ? value.trim() : "";
  return includes(JOB_SOURCE_TYPES, v) ? v : null;
}
