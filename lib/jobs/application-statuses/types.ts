import type { ApplicationPipelineStatus } from "@/lib/jobs/application-status";

export type ApplicationStatusRecord = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  systemKey: ApplicationPipelineStatus | "withdrawn" | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationStatusHistoryRecord = {
  id: string;
  applicationId: string;
  tenantId: string;
  fromStatusId: string | null;
  fromStatusName: string | null;
  toStatusId: string | null;
  toStatusName: string;
  changedByUserId: string | null;
  changedByName: string | null;
  note: string | null;
  createdAt: string;
};

export type ChangeApplicationStatusResult = {
  unchanged: boolean;
  application: {
    id: string;
    statusId: string;
    status: string;
    statusName: string;
  };
  history: {
    id: string;
    fromStatus: { id: string | null; name: string | null };
    toStatus: { id: string; name: string };
    note: string | null;
    changedByUserId: string | null;
    changedAt: string;
  } | null;
  postHire?: {
    activated: boolean;
    alreadyActive: boolean;
    phase: string;
    emailSent: boolean;
  } | null;
};

export class ApplicationStatusError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "VALIDATION"
      | "INACTIVE"
      | "CONFLICT"
      | "INTERNAL",
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "ApplicationStatusError";
  }
}
