import { buildEmploymentWorkerLocationFromCandidate } from "@/lib/admin/employment-workers";

export type ConvertWorkerType = "w2" | "1099";

export type WorkerConversionFields = {
  worker_type: ConvertWorkerType;
  employment_classification: "employee" | "contractor";
  tax_withholding_required: boolean;
  payroll_enabled: boolean;
  contractor_payment_enabled: boolean;
  conversion_status: "converted";
};

export type CandidateConversionSnapshot = {
  id: string;
  tenant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_role?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  converted_worker_type?: string | null;
  converted_at?: string | null;
};

export type CandidateConversionState = {
  isConverted: boolean;
  convertedWorkerType: ConvertWorkerType | null;
  convertedAt: string | null;
};

export function normalizeCandidateStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

export function resolveCandidateConversionState(candidate: {
  status?: string | null;
  converted_worker_type?: string | null;
  converted_at?: string | null;
}): CandidateConversionState {
  const status = normalizeCandidateStatus(candidate.status);
  const convertedWorkerType = parseConvertWorkerType(candidate.converted_worker_type);
  const isConverted = status === "converted";

  return {
    isConverted,
    convertedWorkerType: isConverted ? convertedWorkerType : null,
    convertedAt: isConverted ? candidate.converted_at?.trim() || null : null,
  };
}

export function isCandidateAlreadyConverted(candidate: {
  status?: string | null;
}): boolean {
  return normalizeCandidateStatus(candidate.status) === "converted";
}

export function formatConversionDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function resolveConvertedWorkerTypeLabel(
  convertedWorkerType: string | null | undefined
): string {
  const parsed = parseConvertWorkerType(convertedWorkerType);
  if (parsed) return workerConversionLabel(parsed);
  const raw = typeof convertedWorkerType === "string" ? convertedWorkerType.trim() : "";
  return raw || "Unknown worker type";
}

export function convertedWorkerSummaryMessage(
  convertedWorkerType: string | null | undefined
): string {
  return `This candidate has already been converted to ${resolveConvertedWorkerTypeLabel(convertedWorkerType)}.`;
}

export function parseConvertWorkerType(value: unknown): ConvertWorkerType | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "w2" || normalized === "w-2") return "w2";
  if (normalized === "1099") return "1099";
  return null;
}

/** Maps UI selection to `workers` table employment columns. */
export function workerConversionFields(type: ConvertWorkerType): WorkerConversionFields {
  if (type === "w2") {
    return {
      worker_type: "w2",
      employment_classification: "employee",
      tax_withholding_required: true,
      payroll_enabled: true,
      contractor_payment_enabled: false,
      conversion_status: "converted",
    };
  }

  return {
    worker_type: "1099",
    employment_classification: "contractor",
    tax_withholding_required: false,
    payroll_enabled: false,
    contractor_payment_enabled: true,
    conversion_status: "converted",
  };
}

export function workerConversionLabel(type: ConvertWorkerType): string {
  return type === "w2" ? "W-2 Employee" : "1099 Contractor";
}

export function buildEmploymentWorkerRow(
  candidate: CandidateConversionSnapshot,
  type: ConvertWorkerType,
  convertedAt: string
) {
  const fields = workerConversionFields(type);
  return {
    tenant_id: candidate.tenant_id,
    candidate_id: candidate.id,
    first_name: candidate.first_name?.trim() || null,
    last_name: candidate.last_name?.trim() || null,
    email: candidate.email?.trim() || null,
    phone: candidate.phone?.trim() || null,
    job_role: candidate.job_role?.trim() || null,
    location: buildEmploymentWorkerLocationFromCandidate(candidate),
    status: "active",
    ...fields,
    converted_at: convertedAt,
    updated_at: convertedAt,
  };
}
