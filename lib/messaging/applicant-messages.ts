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
  const hasText = typeof row.body === "string";
  const hasAttachment = typeof row.attachment_path === "string";
  return (
    typeof row.id === "string" &&
    (row.sender_role === "applicant" || row.sender_role === "recruiter") &&
    (hasText || hasAttachment) &&
    typeof row.created_at === "string"
  );
}

export function toApplicantMessageRow(value: unknown): ApplicantMessage | null {
  if (!isApplicantMessageRow(value)) return null;
  return {
    id: value.id,
    sender_role: value.sender_role,
    body: typeof value.body === "string" ? value.body : null,
    created_at: value.created_at,
    message_type:
      value.message_type === "image" || value.message_type === "file" || value.message_type === "text"
        ? value.message_type
        : "text",
    attachment_bucket: typeof value.attachment_bucket === "string" ? value.attachment_bucket : null,
    attachment_path: typeof value.attachment_path === "string" ? value.attachment_path : null,
    attachment_name: typeof value.attachment_name === "string" ? value.attachment_name : null,
    attachment_mime: typeof value.attachment_mime === "string" ? value.attachment_mime : null,
    attachment_size: typeof value.attachment_size === "number" ? value.attachment_size : null,
    attachment_url: typeof value.attachment_url === "string" ? value.attachment_url : null,
  };
}
