import { describe, expect, it } from "vitest";
import { buildCommunicationThreads } from "./conversation";
import { buildMailSentListItems, countOutboundMessages } from "./mail-list-items";
import type { CandidateCommunicationRow } from "./record";
import type { TenantMailInboxItem } from "./list-tenant-mail-inbox";

describe("Sent folder delivery status", () => {
  it("excludes failed outbound attempts while keeping them in conversation history", () => {
    const messages: CandidateCommunicationRow[] = ["sent", "failed", "received"].map((status, index) => ({
      id: String(index), channel: "email", recipient: "qa@brasshr.com", subject: "QA", body: "Message",
      status: status as CandidateCommunicationRow["status"], direction: status === "received" ? "inbound" : "outbound",
      created_at: `2026-11-24T10:0${index}:00Z`, provider_message_id: null, body_html: null,
      conversation_id: null, contact_email: "qa@brasshr.com", from_email: null, to_email: null,
      in_reply_to: null, email_references: null, normalized_subject: null, error_message: status === "failed" ? "Rejected" : null, sent_by_user_id: null,
    }));
    const thread = buildCommunicationThreads(messages, "worker-1", { email: "qa@brasshr.com", phone: null })[0];
    const items: TenantMailInboxItem[] = [{ workerId: "worker-1", candidateName: "QA", contactEmail: "qa@brasshr.com", contactPhone: null, profilePhotoUrl: null, thread }];
    expect(buildMailSentListItems(items).map((row) => row.id)).toEqual(["0"]);
    expect(countOutboundMessages(items)).toBe(1);
    expect(thread.messages).toHaveLength(3);
  });
});
