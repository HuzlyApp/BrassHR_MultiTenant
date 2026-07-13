import type { SupabaseClient } from "@supabase/supabase-js";
import { applicantDisplayName } from "@/lib/applicant-portal";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";
import { computeWorkerProfileCompletionPercent } from "@/lib/applicant-portal/worker-profile-completion";
import { loadWorkerProfileSkills } from "@/lib/worker-profile-skills";
import type { WorkerAccountOverviewPayload } from "@/app/application/components/applicant-portal/worker-account-types";

type WorkerRow = {
  id: string;
  tenant_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  job_role: string | null;
  status: string | null;
  created_at: string | null;
  hourly_rate: string | number | null;
  positions: string[] | null;
  years_experience: number | null;
  experience_years: number | null;
  profile_photo: string | null;
  employee_id: string | null;
  employee_number: string | null;
  employment_type: string | null;
  converted_worker_type: string | null;
  reports_to: string | null;
  manager_name: string | null;
  about_me: string | null;
};

type EmploymentWorkerRow = {
  worker_type: string | null;
  employment_classification: string | null;
};

type AttendanceRow = {
  total_seconds: number | null;
  status: string;
  clock_in_at: string | null;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function formatAddress(worker: WorkerRow): string {
  const parts = [
    worker.address1,
    worker.address2,
    [worker.city, worker.state].filter(Boolean).join(", "),
    worker.zip,
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  return parts.join(" ") || "—";
}

function formatEmploymentTypeLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "—";
  if (normalized === "w2" || normalized === "w-2") return "W-2";
  if (normalized === "1099") return "1099";
  if (normalized === "contractor") return "Contractor";
  if (normalized === "employee") return "Employee";
  return value!.trim();
}

function resolveEmploymentType(
  worker: WorkerRow,
  employmentWorker: EmploymentWorkerRow | null
): string {
  const candidates = [
    worker.employment_type,
    worker.converted_worker_type,
    employmentWorker?.worker_type,
    employmentWorker?.employment_classification,
  ];

  for (const candidate of candidates) {
    const label = formatEmploymentTypeLabel(candidate);
    if (label !== "—") return label;
  }

  return "—";
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatHireDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatUploadedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Uploaded recently";
  return `Uploaded ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function sumAttendanceHours(logs: AttendanceRow[]): number {
  return logs.reduce((total, log) => {
    if (log.total_seconds != null) return total + log.total_seconds / 3600;
    if (log.status === "clocked_in" && log.clock_in_at) {
      const clockIn = new Date(log.clock_in_at);
      const elapsed = (Date.now() - clockIn.getTime()) / (1000 * 60 * 60);
      return total + Math.max(0, elapsed);
    }
    return total;
  }, 0);
}

function serializeProfile(
  worker: WorkerRow,
  employmentWorker: EmploymentWorkerRow | null,
  profilePhotoUrl: string | null,
  profileCompletionPercent: number
): WorkerAccountOverviewPayload["profile"] {
  const positions = toStringArray(worker.positions);
  const yearsExperience = worker.years_experience ?? worker.experience_years ?? null;

  return {
    id: worker.id,
    tenantId: worker.tenant_id,
    firstName: worker.first_name ?? "",
    lastName: worker.last_name ?? "",
    email: worker.email ?? "",
    phone: worker.phone ?? "",
    address1: worker.address1 ?? "",
    address2: worker.address2 ?? "",
    city: worker.city ?? "",
    state: worker.state ?? "",
    zip: worker.zip ?? "",
    jobRole: worker.job_role ?? "",
    statusLabel: worker.status ?? "approved",
    displayName: applicantDisplayName({
      id: worker.id,
      tenant_id: worker.tenant_id,
      user_id: null,
      email: worker.email,
      first_name: worker.first_name,
      last_name: worker.last_name,
      status: worker.status,
      applicant_password_set_at: null,
    }),
    fullAddress: formatAddress(worker),
    employeeId: displayOrDash(worker.employee_id ?? worker.employee_number),
    hireDateLabel: formatHireDate(worker.created_at),
    employmentType: resolveEmploymentType(worker, employmentWorker),
    department: worker.job_role?.trim() || "—",
    supervisorName: worker.reports_to?.trim() || worker.manager_name?.trim() || null,
    hourlyRate: worker.hourly_rate != null ? String(worker.hourly_rate) : null,
    positions,
    yearsExperience,
    profileCompletionPercent,
    profilePhotoUrl,
  };
}

async function resolveProfilePhotoUrl(
  supabase: SupabaseClient,
  profilePhoto: string | null
): Promise<string | null> {
  const value = profilePhoto?.trim() ?? "";
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return createSignedPortalFileUrl(supabase, value);
}

function normalizeWorkerRow(data: Record<string, unknown>): WorkerRow {
  return {
    id: String(data.id ?? ""),
    tenant_id: String(data.tenant_id ?? ""),
    first_name: typeof data.first_name === "string" ? data.first_name : null,
    last_name: typeof data.last_name === "string" ? data.last_name : null,
    email: typeof data.email === "string" ? data.email : null,
    phone: typeof data.phone === "string" ? data.phone : null,
    address1: typeof data.address1 === "string" ? data.address1 : null,
    address2: typeof data.address2 === "string" ? data.address2 : null,
    city: typeof data.city === "string" ? data.city : null,
    state: typeof data.state === "string" ? data.state : null,
    zip: typeof data.zip === "string" ? data.zip : null,
    job_role: typeof data.job_role === "string" ? data.job_role : null,
    status: typeof data.status === "string" ? data.status : null,
    created_at: typeof data.created_at === "string" ? data.created_at : null,
    hourly_rate:
      typeof data.hourly_rate === "string" || typeof data.hourly_rate === "number"
        ? data.hourly_rate
        : null,
    positions: Array.isArray(data.positions) ? (data.positions as string[]) : null,
    years_experience: typeof data.years_experience === "number" ? data.years_experience : null,
    experience_years: typeof data.experience_years === "number" ? data.experience_years : null,
    profile_photo: typeof data.profile_photo === "string" ? data.profile_photo : null,
    employee_id: typeof data.employee_id === "string" ? data.employee_id : null,
    employee_number: typeof data.employee_number === "string" ? data.employee_number : null,
    employment_type: typeof data.employment_type === "string" ? data.employment_type : null,
    converted_worker_type:
      typeof data.converted_worker_type === "string" ? data.converted_worker_type : null,
    reports_to: typeof data.reports_to === "string" ? data.reports_to : null,
    manager_name: typeof data.manager_name === "string" ? data.manager_name : null,
    about_me: typeof data.about_me === "string" ? data.about_me : null,
  };
}

function normalizeEmploymentWorkerRow(
  data: Record<string, unknown> | null
): EmploymentWorkerRow | null {
  if (!data) return null;
  return {
    worker_type: typeof data.worker_type === "string" ? data.worker_type : null,
    employment_classification:
      typeof data.employment_classification === "string"
        ? data.employment_classification
        : null,
  };
}

export async function loadWorkerAccountOverview(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<WorkerAccountOverviewPayload | null> {
  const [
    workerRes,
    employmentWorkerRes,
    portalDocsRes,
    submittedDocsRes,
    allSubmittedDocsRes,
    portalDocsCountRes,
    licensesRes,
    licensesCountRes,
    attendanceRes,
    assessmentsRes,
    profileSkills,
  ] = await Promise.all([
    supabase.from("worker").select("*").eq("id", workerId).maybeSingle(),
    supabase
      .from("workers")
      .select("worker_type, employment_classification")
      .eq("candidate_id", workerId)
      .maybeSingle(),
    supabase
      .from("worker_portal_documents")
      .select("id, title, original_file_name, uploaded_at, status")
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false })
      .limit(8),
    supabase
      .from("worker_submitted_documents")
      .select("id, original_file_name, uploaded_at, status, required_document_id")
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false })
      .limit(8),
    supabase.from("worker_submitted_documents").select("required_document_id").eq("worker_id", workerId),
    supabase
      .from("worker_portal_documents")
      .select("id", { count: "exact", head: true })
      .eq("worker_id", workerId),
    supabase
      .from("worker_license_records")
      .select("id, license_type, original_file_name, expires_at, status, uploaded_at")
      .eq("worker_id", workerId)
      .order("uploaded_at", { ascending: false })
      .limit(6),
    supabase
      .from("worker_license_records")
      .select("id", { count: "exact", head: true })
      .eq("worker_id", workerId),
    supabase
      .from("applicant_attendance_logs")
      .select("total_seconds, status, clock_in_at")
      .eq("worker_id", workerId)
      .order("attendance_date", { ascending: false })
      .limit(200),
    supabase.from("skill_assessments").select("category, completed, answers").eq("worker_id", workerId),
    loadWorkerProfileSkills(supabase, workerId),
  ]);

  if (workerRes.error) throw workerRes.error;
  if (employmentWorkerRes.error) throw employmentWorkerRes.error;
  if (!workerRes.data) return null;

  const worker = normalizeWorkerRow(workerRes.data as Record<string, unknown>);
  const employmentWorker = normalizeEmploymentWorkerRow(
    (employmentWorkerRes.data as Record<string, unknown> | null) ?? null
  );
  const profilePhotoUrl = await resolveProfilePhotoUrl(supabase, worker.profile_photo);

  const requiredRes = await supabase
    .from("tenant_required_documents")
    .select("id, title")
    .eq("tenant_id", tenantId);

  const submittedRequiredDocumentIds = (allSubmittedDocsRes.data ?? []).map((row) =>
    String(row.required_document_id ?? "")
  );
  const completedAssessmentCount = (assessmentsRes.data ?? []).filter((row) => row.completed).length;
  const profileCompletionPercent = computeWorkerProfileCompletionPercent({
    worker: {
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
      phone: worker.phone,
      address1: worker.address1,
      city: worker.city,
      state: worker.state,
      zip: worker.zip,
      positions: worker.positions,
    },
    hasProfilePhoto: Boolean(profilePhotoUrl),
    requiredDocumentCount: (requiredRes.data ?? []).length,
    submittedRequiredDocumentIds,
    portalDocumentCount: portalDocsCountRes.count ?? 0,
    licenseCount: licensesCountRes.count ?? 0,
    completedAssessmentCount,
    profileSkillCount: profileSkills.length,
  });

  const profile = serializeProfile(worker, employmentWorker, profilePhotoUrl, profileCompletionPercent);

  const requiredMap = new Map(
    (requiredRes.data ?? []).map((row) => [String(row.id), String(row.title ?? "Document")])
  );

  const recentDocuments = [
    ...(portalDocsRes.data ?? []).map((row) => ({
      id: String(row.id),
      source: "portal" as const,
      title: String(row.title ?? row.original_file_name ?? "Document"),
      fileName: String(row.original_file_name ?? row.title ?? "Document"),
      uploadedAt: String(row.uploaded_at),
      uploadedLabel: formatUploadedLabel(String(row.uploaded_at)),
      statusLabel: documentStatusLabel(String(row.status ?? "uploaded")),
    })),
    ...(submittedDocsRes.data ?? []).map((row) => ({
      id: String(row.id),
      source: "required" as const,
      title: requiredMap.get(String(row.required_document_id)) ?? "Required document",
      fileName: String(row.original_file_name ?? "Document"),
      uploadedAt: String(row.uploaded_at),
      uploadedLabel: formatUploadedLabel(String(row.uploaded_at)),
      statusLabel: documentStatusLabel(String(row.status ?? "uploaded")),
    })),
  ]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  const certifications = (licensesRes.data ?? []).map((row) => {
    const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
    const expiresLabel =
      expiresAt && !Number.isNaN(expiresAt.getTime())
        ? expiresAt.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;

    return {
      id: String(row.id),
      title: String(row.original_file_name ?? row.license_type ?? "Certification"),
      licenseType: String(row.license_type ?? ""),
      expiresLabel,
      statusLabel: documentStatusLabel(String(row.status ?? "uploaded")),
    };
  });

  const attendanceLogs = (attendanceRes.data ?? []) as AttendanceRow[];
  const totalHours = sumAttendanceHours(attendanceLogs);
  const totalShifts = attendanceLogs.filter(
    (log) => log.total_seconds != null || log.status === "clocked_out"
  ).length;

  const hourlyRate = profile.hourlyRate ? Number.parseFloat(profile.hourlyRate) : NaN;
  const earnings =
    Number.isFinite(hourlyRate) && hourlyRate > 0 ? totalHours * hourlyRate : null;

  const skills = profileSkills.map((skill) => skill.skill_name).filter(Boolean);

  const roleLabel = profile.jobRole.trim() || "team member";
  const storedAboutMe = worker.about_me?.trim() ?? "";
  const aboutMe =
    storedAboutMe ||
    (profile.yearsExperience != null
      ? `Experienced ${roleLabel} with ${profile.yearsExperience} years in the field. Committed to safe, reliable work and strong team support.`
      : `Dedicated ${roleLabel} focused on quality work, clear communication, and dependable attendance.`);

  return {
    profile,
    aboutMe,
    skills,
    certifications,
    recentDocuments,
    workSummary: {
      totalShifts,
      hoursWorked: totalHours,
      earnings,
      rating: null,
    },
  };
}
