export type WorkerAccountTab =
  | "overview"
  | "personal"
  | "employment"
  | "documents"
  | "skills"
  | "emergency"
  | "account";

export type WorkerAccountProfile = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  jobRole: string;
  statusLabel: string;
  displayName: string;
  fullAddress: string;
  employeeId: string;
  hireDateLabel: string;
  employmentType: string;
  department: string;
  supervisorName: string | null;
  hourlyRate: string | null;
  positions: string[];
  yearsExperience: number | null;
  profileCompletionPercent: number;
  profilePhotoUrl: string | null;
};

export type WorkerAccountOverviewPayload = {
  profile: WorkerAccountProfile;
  aboutMe: string;
  skills: string[];
  certifications: Array<{
    id: string;
    title: string;
    licenseType: string;
    expiresLabel: string | null;
    statusLabel: string;
  }>;
  recentDocuments: Array<{
    id: string;
    source: "portal" | "required";
    title: string;
    fileName: string;
    uploadedAt: string;
    uploadedLabel: string;
    statusLabel: string;
  }>;
  workSummary: {
    totalShifts: number;
    hoursWorked: number;
    earnings: number | null;
    rating: number | null;
  };
};

export const WORKER_ACCOUNT_TABS: Array<{ id: WorkerAccountTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "personal", label: "Personal Information" },
  { id: "employment", label: "Employment Details" },
  { id: "documents", label: "Documents" },
  { id: "skills", label: "Skills & Certifications" },
  // { id: "emergency", label: "Emergency Contact" },
  // { id: "account", label: "Account" },
];

export const WORKER_ACCOUNT_PROFILE_HREF = "/application/applicant-dashboard/profile";

export function workerAccountTabHref(tab: WorkerAccountTab): string {
  if (tab === "overview") return WORKER_ACCOUNT_PROFILE_HREF;
  return `${WORKER_ACCOUNT_PROFILE_HREF}?tab=${tab}`;
}

export function parseWorkerAccountTab(value: string | null | undefined): WorkerAccountTab {
  const match = WORKER_ACCOUNT_TABS.find((tab) => tab.id === value);
  return match?.id ?? "overview";
}
