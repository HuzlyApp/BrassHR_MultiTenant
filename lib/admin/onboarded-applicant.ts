import { resolveCandidateConversionState } from "@/lib/admin/convert-candidate-to-worker";

export type OnboardedProgressMetricTheme = "green" | "orange" | "blue" | "purple";

export type OnboardedProgressMetric = {
  id: string;
  label: string;
  value: string;
  theme: OnboardedProgressMetricTheme;
};

export type OnboardedListItem = {
  id: string;
  title: string;
  status: string;
  statusTone: "complete" | "signed" | "pending";
  date?: string;
};

export type OnboardedWhatsNextItem = {
  id: string;
  title: string;
  description: string;
  date: string;
};

export type OnboardedApplicantViewModel = {
  isApproved: boolean;
  isConverted: boolean;
  convertedWorkerType: "w2" | "1099" | null;
  convertedWorkerTypeRaw: string | null;
  convertedAt: string | null;
  candidateName: string;
  candidateRole: string;
  profilePhotoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  employeeId: string;
  department: string;
  reportsTo: string;
  hireDate: string;
  employmentType: string;
  currentStatus: string;
  onboardedDate: string;
  orientationDate: string;
  progressMetrics: OnboardedProgressMetric[];
  progressSummary: string;
  checklistItems: OnboardedListItem[];
  workerSetupItems: OnboardedListItem[];
  whatsNextItems: OnboardedWhatsNextItem[];
  onboardingCompletionPercent: number;
};

type ChecklistRow = {
  id: string;
  title: string;
  state: string;
  badge?: string;
  checked?: boolean;
};

type ChecklistSection = {
  id: string;
  title?: string;
  rows: ChecklistRow[];
};

type OnboardingStep = {
  id: string;
  label: string;
  state: string;
  detail?: string;
};

type ProfileWorker = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  job_role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  converted_worker_type?: string | null;
  converted_at?: string | null;
  profile_photo_url?: string | null;
  employee_id?: string | null;
  employee_number?: string | null;
  employment_type?: string | null;
  reports_to?: string | null;
};

type ProfilePayload = {
  worker?: ProfileWorker;
  onboardingCompletion?: { percent?: number };
  onboardingSteps?: OnboardingStep[];
  attachment_requirements?: Array<{
    id: string;
    title: string;
    status?: string | null;
    url?: string | null;
  }>;
};

type ChecklistPayload = {
  worker?: { status?: string | null };
  meta?: { progressPercent?: number };
  sections?: ChecklistSection[];
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatEmploymentType(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "—";
  if (normalized === "w2" || normalized === "w-2") return "W-2";
  if (normalized === "1099" || normalized === "contractor") return "1099 Contractor";
  return value!.trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatAddress(worker: ProfileWorker | undefined): string | null {
  if (!worker) return null;
  const line1 = worker.address1?.trim() ?? "";
  const line2 = worker.address2?.trim() ?? "";
  const cityState = [worker.city?.trim(), worker.state?.trim()].filter(Boolean).join(", ");
  const zip = worker.zip?.trim() ?? "";
  const parts = [line1, line2, [cityState, zip].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function rowIsPassed(row: ChecklistRow | null): boolean {
  if (!row) return false;
  return (
    row.checked === true ||
    row.state === "complete" ||
    row.state === "uploaded" ||
    row.state === "answered"
  );
}

function allChecklistRows(sections: ChecklistSection[] | undefined): ChecklistRow[] {
  return (sections ?? []).flatMap((section) => section.rows);
}

const ONBOARDING_CHECKLIST_SECTION_IDS = ["claimed", "new_hire", "final"] as const;

function checklistRowsForOnboardingCard(sections: ChecklistSection[] | undefined): ChecklistRow[] {
  const matched = (sections ?? [])
    .filter((section) =>
      ONBOARDING_CHECKLIST_SECTION_IDS.includes(
        section.id as (typeof ONBOARDING_CHECKLIST_SECTION_IDS)[number]
      )
    )
    .flatMap((section) => section.rows);

  if (matched.length > 0) return matched.slice(0, 8);
  return allChecklistRows(sections).slice(0, 8);
}

function mapChecklistRowToItem(row: ChecklistRow, completedDate: string): OnboardedListItem {
  const passed = rowIsPassed(row);
  const badge = row.badge?.trim();
  const status = badge || (passed ? "Completed" : "Pending");
  const statusLower = status.toLowerCase();

  let statusTone: OnboardedListItem["statusTone"] = "pending";
  if (passed) {
    statusTone =
      statusLower.includes("signed") || statusLower.includes("uploaded") ? "signed" : "complete";
  }

  return {
    id: row.id,
    title: row.title,
    status,
    statusTone,
    date: passed ? completedDate : undefined,
  };
}

function mapOnboardingStepToItem(step: OnboardingStep, completedDate: string): OnboardedListItem {
  const state = step.state.trim().toLowerCase();
  const done = state === "complete" || state === "uploaded" || state === "signed";
  const inProgress = state === "in_progress" || state === "in progress";

  let status = "Pending";
  let statusTone: OnboardedListItem["statusTone"] = "pending";

  if (done) {
    status = state === "signed" ? "Signed" : "Completed";
    statusTone = state === "signed" ? "signed" : "complete";
  } else if (inProgress) {
    status = "In Progress";
  } else if (step.detail?.trim()) {
    status = step.detail.trim();
  }

  return {
    id: step.id,
    title: step.label,
    status,
    statusTone,
    date: done ? completedDate : undefined,
  };
}

function buildProgressSummary(
  firstName: string,
  pendingItems: number,
  completionPercent: number
): string {
  if (pendingItems === 0 && completionPercent >= 100) {
    return `All onboarding tasks have been completed. ${firstName} is all set to start their journey with us!`;
  }
  if (pendingItems === 0) {
    return `${firstName} has completed the available onboarding steps and is ready for the next stage.`;
  }
  return `${firstName} still has ${pendingItems} pending onboarding item${pendingItems === 1 ? "" : "s"}. Please review the checklist below.`;
}

function countSignedDocuments(
  attachments: ProfilePayload["attachment_requirements"]
): number {
  return (attachments ?? []).filter((doc) => {
    const status = (doc.status ?? "").toLowerCase();
    return Boolean(doc.url) || status === "approved" || status === "uploaded" || status === "complete";
  }).length;
}

export function buildOnboardedApplicantViewModel(
  profile: ProfilePayload,
  checklist: ChecklistPayload
): OnboardedApplicantViewModel {
  const worker = profile.worker ?? {};
  const candidateName =
    `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim() || "Applicant";
  const candidateRole = worker.job_role?.trim() || "—";
  const statusNorm = (worker.status ?? checklist.worker?.status ?? "new").toString().trim().toLowerCase();
  const isApproved = statusNorm === "approved" || statusNorm === "converted";
  const conversion = resolveCandidateConversionState(worker);
  const { isConverted, convertedWorkerType, convertedAt } = conversion;
  const convertedWorkerTypeRaw = worker.converted_worker_type?.trim() || null;

  const onboardingCompletionPercent = clampPercent(profile.onboardingCompletion?.percent ?? 0);
  const checklistProgressPercent = clampPercent(checklist.meta?.progressPercent ?? 0);
  const completionPercent = Math.max(onboardingCompletionPercent, checklistProgressPercent);

  const rows = allChecklistRows(checklist.sections);
  const completedTasks = rows.filter((row) => rowIsPassed(row)).length;
  const totalTasks = rows.length;
  const signedDocuments = countSignedDocuments(profile.attachment_requirements);
  const pendingItems = Math.max(0, totalTasks - completedTasks);

  const hireDate = formatDate(worker.created_at);
  const completedDate = formatDate(worker.updated_at ?? worker.created_at);
  const onboardedDate = hireDate;
  const orientationDate = hireDate;

  const checklistItems: OnboardedListItem[] = checklistRowsForOnboardingCard(
    checklist.sections
  ).map((row) => mapChecklistRowToItem(row, completedDate));

  const workerSetupItems: OnboardedListItem[] = (profile.onboardingSteps ?? []).map((step) =>
    mapOnboardingStepToItem(step, completedDate)
  );

  const firstName = candidateName.split(/\s+/)[0] || candidateName;

  return {
    isApproved,
    isConverted,
    convertedWorkerType,
    convertedWorkerTypeRaw,
    convertedAt,
    candidateName,
    candidateRole,
    profilePhotoUrl: worker.profile_photo_url ?? null,
    email: worker.email ?? null,
    phone: worker.phone ?? null,
    address: formatAddress(worker),
    employeeId: displayOrDash(worker.employee_id ?? worker.employee_number),
    department: candidateRole !== "—" ? candidateRole : "Operations",
    reportsTo: displayOrDash(worker.reports_to),
    hireDate,
    employmentType: formatEmploymentType(worker.employment_type),
    currentStatus: "Active - Onboarded",
    onboardedDate,
    orientationDate,
    onboardingCompletionPercent: completionPercent,
    progressMetrics: [
      {
        id: "completed",
        label: "Completed",
        value: `${completionPercent}%`,
        theme: "green",
      },
      {
        id: "tasks",
        label: "Task Completed",
        value: totalTasks > 0 ? `${completedTasks}/${totalTasks}` : `${completedTasks}`,
        theme: "orange",
      },
      {
        id: "documents",
        label: "Document Signed",
        value: String(signedDocuments),
        theme: "blue",
      },
      {
        id: "pending",
        label: "Pending Items",
        value: String(pendingItems),
        theme: "purple",
      },
    ],
    progressSummary: buildProgressSummary(firstName, pendingItems, completionPercent),
    checklistItems,
    workerSetupItems,
    whatsNextItems: [
      {
        id: "first-day",
        title: "First Day at Work",
        description: "Report to your assigned location and meet your team lead.",
        date: onboardedDate,
      },
      {
        id: "schedule",
        title: "Schedule Confirmation",
        description: "Review your work schedule and confirm your shifts.",
        date: onboardedDate,
      },
      {
        id: "team",
        title: "Team Introduction",
        description: "Meet your team members and get oriented to your role.",
        date: orientationDate,
      },
    ],
  };
}
