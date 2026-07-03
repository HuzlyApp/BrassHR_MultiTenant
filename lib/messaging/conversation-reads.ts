export type ConversationReadRow = {
  worker_id: string;
  last_read_at: string;
};

/** Build worker_id → last_read_at ISO map for unread calculations. */
export function lastReadAtByWorkerId(
  rows: ConversationReadRow[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const workerId = row.worker_id?.trim();
    const at = row.last_read_at?.trim();
    if (workerId && at) map.set(workerId, at);
  }
  return map;
}

/** Applicant messages created after last_read_at count as unread for this staff user. */
export function isApplicantMessageUnread(
  message: { sender_role: string; created_at: string },
  lastReadAt: string | null | undefined
): boolean {
  if (message.sender_role !== "applicant") return false;
  const readAt = lastReadAt?.trim();
  if (!readAt) return true;
  const msgTime = new Date(message.created_at).getTime();
  const readTime = new Date(readAt).getTime();
  if (Number.isNaN(msgTime)) return true;
  if (Number.isNaN(readTime)) return true;
  return msgTime > readTime;
}
