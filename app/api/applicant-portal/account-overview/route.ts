import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applicantDisplayName } from "@/lib/applicant-portal";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { createSignedPortalFileUrl } from "@/lib/applicant-portal/upload";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

function queryErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Could not load account overview";
}

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

function formatEmployeeId(workerId: string): string {
  const compact = workerId.replace(/-/g, "").toUpperCase();
  return `BRH-${compact.slice(0, 5)}`;
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

function formatCategoryLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function profileCompletionPercent(worker: WorkerRow): number {
  const checks = [
    worker.first_name,
    worker.last_name,
    worker.email,
    worker.phone,
    worker.address1,
    worker.city,
    worker.state,
    worker.zip,
    worker.job_role,
  ];
  const filled = checks.filter((value) => String(value ?? "").trim().length > 0).length;
  return Math.round((filled / checks.length) * 100);
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

function serializeProfile(worker: WorkerRow, profilePhotoUrl: string | null) {
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
    employeeId: formatEmployeeId(worker.id),
    hireDateLabel: formatHireDate(worker.created_at),
    employmentType: "Part Time",
    department: worker.job_role?.trim() || "—",
    supervisorName: null as string | null,
    hourlyRate: worker.hourly_rate != null ? String(worker.hourly_rate) : null,
    positions,
    yearsExperience,
    profileCompletionPercent: profileCompletionPercent(worker),
    profilePhotoUrl,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const workerId = auth.applicant.id;
    const tenantId = auth.applicant.tenant_id;

    const [
      workerRes,
      portalDocsRes,
      submittedDocsRes,
      licensesRes,
      attendanceRes,
      assessmentsRes,
    ] = await Promise.all([
      auth.supabase.from("worker").select("*").eq("id", workerId).maybeSingle(),
      auth.supabase
        .from("worker_portal_documents")
        .select("id, title, original_file_name, uploaded_at, status")
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false })
        .limit(8),
      auth.supabase
        .from("worker_submitted_documents")
        .select("id, original_file_name, uploaded_at, status, required_document_id")
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false })
        .limit(8),
      auth.supabase
        .from("worker_license_records")
        .select("id, license_type, original_file_name, expires_at, status, uploaded_at")
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false })
        .limit(6),
      auth.supabase
        .from("applicant_attendance_logs")
        .select("total_seconds, status, clock_in_at")
        .eq("worker_id", workerId)
        .order("attendance_date", { ascending: false })
        .limit(200),
      auth.supabase
        .from("skill_assessments")
        .select("category, completed, answers")
        .eq("worker_id", workerId),
    ]);

    if (workerRes.error) throw workerRes.error;
    if (!workerRes.data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const worker = normalizeWorkerRow(workerRes.data as Record<string, unknown>);
    const profilePhotoUrl = await resolveProfilePhotoUrl(auth.supabase, worker.profile_photo);
    const profile = serializeProfile(worker, profilePhotoUrl);

    const requiredRes = await auth.supabase
      .from("tenant_required_documents")
      .select("id, title")
      .eq("tenant_id", tenantId);
    if (requiredRes.error) {
      console.warn("[applicant-portal/account-overview] tenant_required_documents", requiredRes.error.message);
    }

    const requiredMap = new Map(
      (requiredRes.data ?? []).map((row) => [String(row.id), String(row.title ?? "Document")])
    );

    if (portalDocsRes.error) {
      console.warn("[applicant-portal/account-overview] worker_portal_documents", portalDocsRes.error.message);
    }
    if (submittedDocsRes.error) {
      console.warn("[applicant-portal/account-overview] worker_submitted_documents", submittedDocsRes.error.message);
    }
    if (licensesRes.error) {
      console.warn("[applicant-portal/account-overview] worker_license_records", licensesRes.error.message);
    }
    if (attendanceRes.error) {
      console.warn("[applicant-portal/account-overview] applicant_attendance_logs", attendanceRes.error.message);
    }
    if (assessmentsRes.error) {
      console.warn("[applicant-portal/account-overview] skill_assessments", assessmentsRes.error.message);
    }

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
      Number.isFinite(hourlyRate) && hourlyRate > 0
        ? totalHours * hourlyRate
        : null;

    const assessedSkills = (assessmentsRes.data ?? [])
      .filter((row) => row.completed)
      .map((row) => formatCategoryLabel(String(row.category ?? "")))
      .filter(Boolean);

    const skills = Array.from(new Set([...profile.positions, ...assessedSkills])).slice(0, 8);

    const roleLabel = profile.jobRole.trim() || "team member";
    const aboutMe =
      profile.yearsExperience != null
        ? `Experienced ${roleLabel} with ${profile.yearsExperience} years in the field. Committed to safe, reliable work and strong team support.`
        : `Dedicated ${roleLabel} focused on quality work, clear communication, and dependable attendance.`;

    return NextResponse.json({
      profile,
      aboutMe,
      skills,
      certifications,
      recentDocuments,
      workSummary: {
        totalShifts,
        hoursWorked: totalHours,
        earnings,
        rating: null as number | null,
      },
    });
  } catch (err) {
    console.error("[applicant-portal/account-overview:get]", err);
    return NextResponse.json({ error: queryErrorMessage(err) }, { status: 500 });
  }
}
