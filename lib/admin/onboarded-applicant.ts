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
  rows: ChecklistRow[];
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
  status?: string | null;
  profile_photo_url?: string | null;
};

type ProfilePayload = {
  worker?: ProfileWorker;
  onboardingCompletion?: { percent?: number };
  onboardingSteps?: Array<{ id: string; label: string; state: string }>;
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
  const isApproved = statusNorm === "approved";

  const onboardingCompletionPercent = clampPercent(profile.onboardingCompletion?.percent ?? 0);
  const checklistProgressPercent = clampPercent(checklist.meta?.progressPercent ?? 0);
  const completionPercent = Math.max(onboardingCompletionPercent, checklistProgressPercent);

  const rows = allChecklistRows(checklist.sections);
  const completedTasks = rows.filter((row) => rowIsPassed(row)).length;
  const totalTasks = rows.length;
  const signedDocuments = countSignedDocuments(profile.attachment_requirements);
  const pendingItems = Math.max(0, totalTasks - completedTasks);

  const hireDate = formatDate(worker.created_at);
  const onboardedDate = hireDate;
  const orientationDate = hireDate;

  const checklistItems: OnboardedListItem[] = rows.slice(0, 4).map((row) => ({
    id: row.id,
    title: row.title,
    status: rowIsPassed(row) ? "Completed" : row.badge?.trim() || "Pending",
    statusTone: rowIsPassed(row) ? "complete" : "pending",
    date: rowIsPassed(row) ? onboardedDate : undefined,
  }));

  if (checklistItems.length === 0) {
    checklistItems.push({
      id: "i9",
      title: "I-9 Form",
      status: "Completed",
      statusTone: "complete",
      date: onboardedDate,
    });
  }

  const workerSetupItems: OnboardedListItem[] = (profile.onboardingSteps ?? [])
    .slice(0, 4)
    .map((step) => {
      const done =
        step.state === "complete" ||
        step.state === "uploaded" ||
        step.state === "signed";
      return {
        id: step.id,
        title: step.label,
        status: done ? "Signed" : "Pending",
        statusTone: done ? "signed" : "pending",
        date: done ? onboardedDate : undefined,
      };
    });

  if (workerSetupItems.length === 0) {
    workerSetupItems.push({
      id: "profile",
      title: "Worker profile created",
      status: "Signed",
      statusTone: "signed",
      date: onboardedDate,
    });
  }

  const firstName = candidateName.split(/\s+/)[0] || candidateName;

  return {
    isApproved,
    candidateName,
    candidateRole,
    profilePhotoUrl: worker.profile_photo_url ?? null,
    email: worker.email ?? null,
    phone: worker.phone ?? null,
    address: formatAddress(worker),
    employeeId: worker.id ? worker.id.slice(0, 8).toUpperCase() : "—",
    department: candidateRole !== "—" ? candidateRole : "Operations",
    reportsTo: "—",
    hireDate,
    employmentType: "W-2",
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
    progressSummary: `All onboarding tasks have been completed. ${firstName} is all set to start their journey with us!`,
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
