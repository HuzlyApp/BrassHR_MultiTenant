import type { ApplicantMessage } from "@/app/application/components/applicant-portal/types";

export type { ApplicantMessage };

export function sortApplicantMessages(messages: ApplicantMessage[]): ApplicantMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function mergeApplicantMessage(
  existing: ApplicantMessage[],
  incoming: ApplicantMessage
): ApplicantMessage[] {
  if (!incoming?.id || existing.some((message) => message.id === incoming.id)) {
    return existing;
  }
  return sortApplicantMessages([...existing, incoming]);
}

export function isApplicantMessageRow(value: unknown): value is ApplicantMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.sender_role === "applicant" || row.sender_role === "recruiter") &&
    typeof row.body === "string" &&
    typeof row.created_at === "string"
  );
}

export function toApplicantMessageRow(value: unknown): ApplicantMessage | null {
  if (!isApplicantMessageRow(value)) return null;
  return {
    id: value.id,
    sender_role: value.sender_role,
    body: value.body,
    created_at: value.created_at,
  };
}
