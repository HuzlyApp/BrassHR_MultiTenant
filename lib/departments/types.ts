export type DepartmentRecord = {
  id: string;
  name: string;
  description: string | null;
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
