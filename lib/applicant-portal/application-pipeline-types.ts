import type { ApplicationStatusKey } from "@/lib/applicant-portal";

export type ApplicationPipelineStep = {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  statusLabel: string;
  completedAt: string | null;
  actionHref: string | null;
  actionLabel: string | null;
  isVerificationStep?: boolean;
};

export type ApplicationPipelinePayload = {
  applicationId: string;
  jobTitle: string;
  jobLocation: string | null;
  jobToken: string | null;
  tenantSlug: string | null;
  statusLabel: string;
  submittedAt: string | null;
  hasIncompleteSteps: boolean;
  firstIncompleteStepHref: string | null;
  workerVerificationStatus: ApplicationStatusKey;
  workerVerificationLabel: string;
  steps: ApplicationPipelineStep[];
};
