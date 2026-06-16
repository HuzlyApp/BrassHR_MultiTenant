export type ApplicantMessageListRow = {
  id: string;
  worker_id: string;
  tenant_id: string;
  sender_role: "applicant" | "recruiter";
  body: string | null;
  created_at: string;
  message_type?: "text" | "image" | "file";
  attachment_name?: string | null;
};

export type WorkerSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type StaffConversation = {
  id: string;
  workerId: string;
  applicantName: string;
  preview: string;
  sentAt: string | null;
  unreadCount: number;
  href: string;
};

export function applicantDisplayName(worker: WorkerSummary | undefined): string {
  const name = [worker?.first_name, worker?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || worker?.email || "Applicant";
}

export function groupApplicantMessagesIntoConversations(
  messages: ApplicantMessageListRow[],
  workerMap: Map<string, WorkerSummary>
): StaffConversation[] {
  const grouped = new Map<string, StaffConversation>();

  for (const msg of messages) {
    const worker = workerMap.get(msg.worker_id);
    const applicantName = applicantDisplayName(worker);
    const isUnread = msg.sender_role === "applicant";
    const href = `/admin_recruiter/messages/${msg.worker_id}`;
    const preview = msg.body?.trim() || msg.attachment_name?.trim() || "(attachment)";
    const existing = grouped.get(msg.worker_id);

    if (!existing) {
      grouped.set(msg.worker_id, {
        id: msg.id,
        workerId: msg.worker_id,
        applicantName,
        preview,
        sentAt: msg.created_at,
        unreadCount: isUnread ? 1 : 0,
        href,
      });
      continue;
    }

    existing.unreadCount += isUnread ? 1 : 0;
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (!a.sentAt) return 1;
    if (!b.sentAt) return -1;
    return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
  });
}

export function upsertConversationFromMessage(
  conversations: StaffConversation[],
  message: ApplicantMessageListRow,
  worker?: WorkerSummary
): StaffConversation[] {
  const next = [...conversations];
  const index = next.findIndex((item) => item.workerId === message.worker_id);
  const applicantName = applicantDisplayName(worker);
  const isUnread = message.sender_role === "applicant";
  const preview = message.body?.trim() || message.attachment_name?.trim() || "(attachment)";

  if (index === -1) {
    next.unshift({
      id: message.id,
      workerId: message.worker_id,
      applicantName,
      preview,
      sentAt: message.created_at,
      unreadCount: isUnread ? 1 : 0,
      href: `/admin_recruiter/messages/${message.worker_id}`,
    });
  } else {
    const existing = { ...next[index] };
    existing.preview = preview;
    existing.sentAt = message.created_at;
    existing.unreadCount += isUnread ? 1 : 0;
    if (worker) existing.applicantName = applicantName;
    next.splice(index, 1);
    next.unshift(existing);
  }

  return next.sort((a, b) => {
    if (!a.sentAt) return 1;
    if (!b.sentAt) return -1;
    return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
  });
}

function formatMessageTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export { formatMessageTime };
