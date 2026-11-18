export type DepartmentRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  /** Support-ticket inbox email or alias for this department. */
  primaryContact: string | null;
  isActive: boolean;
  jobCount: number;
  candidateCount: number;
};

export type DepartmentTarget = {
  id: string;
  label: string;
  detail: string | null;
  departmentId: string | null;
  departmentName: string | null;
};

export type DepartmentAssignmentKind = "job" | "candidate";

/** Assignable people for department membership (employment workers only). */
export type DepartmentMemberKind = "worker";

export type DepartmentMemberRef = {
  kind: DepartmentMemberKind;
  id: string;
};

export type DepartmentMember = {
  kind: DepartmentMemberKind;
  id: string;
  label: string;
  email: string | null;
  roleLabel: string | null;
  status: "active" | "inactive";
  departmentId: string | null;
  departmentName: string | null;
};
