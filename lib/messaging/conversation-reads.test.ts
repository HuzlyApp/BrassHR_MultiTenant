import { describe, expect, it } from "vitest";
import {
  isApplicantMessageUnread,
  lastReadAtByWorkerId,
} from "@/lib/messaging/conversation-reads";
import { groupApplicantMessagesIntoConversations } from "@/lib/messaging/staff-conversations";

describe("conversation read tracking", () => {
  it("counts applicant messages after last_read_at as unread", () => {
    expect(
      isApplicantMessageUnread(
        { sender_role: "applicant", created_at: "2026-07-04T12:00:00.000Z" },
        "2026-07-04T11:00:00.000Z"
      )
    ).toBe(true);
    expect(
      isApplicantMessageUnread(
        { sender_role: "applicant", created_at: "2026-07-04T10:00:00.000Z" },
        "2026-07-04T11:00:00.000Z"
      )
    ).toBe(false);
  });

  it("does not mark recruiter messages unread", () => {
    expect(
      isApplicantMessageUnread(
        { sender_role: "recruiter", created_at: "2026-07-04T12:00:00.000Z" },
        null
      )
    ).toBe(false);
  });

  it("groups unread counts per conversation using last read map", () => {
    const messages = [
      {
        id: "m1",
        worker_id: "w1",
        tenant_id: "t1",
        sender_role: "applicant" as const,
        body: "Hello",
        created_at: "2026-07-04T10:00:00.000Z",
      },
      {
        id: "m2",
        worker_id: "w1",
        tenant_id: "t1",
        sender_role: "applicant" as const,
        body: "Follow up",
        created_at: "2026-07-04T12:00:00.000Z",
      },
    ];
    const workerMap = new Map([
      [
        "w1",
        {
          id: "w1",
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
        },
      ],
    ]);
    const unreadBeforeRead = groupApplicantMessagesIntoConversations(messages, workerMap);
    expect(unreadBeforeRead[0]?.unreadCount).toBe(2);

    const readMap = lastReadAtByWorkerId([
      { worker_id: "w1", last_read_at: "2026-07-04T11:00:00.000Z" },
    ]);
    const unreadAfterPartialRead = groupApplicantMessagesIntoConversations(
      messages,
      workerMap,
      readMap
    );
    expect(unreadAfterPartialRead[0]?.unreadCount).toBe(1);

    const fullyReadMap = lastReadAtByWorkerId([
      { worker_id: "w1", last_read_at: "2026-07-04T13:00:00.000Z" },
    ]);
    const unreadAfterFullRead = groupApplicantMessagesIntoConversations(
      messages,
      workerMap,
      fullyReadMap
    );
    expect(unreadAfterFullRead[0]?.unreadCount).toBe(0);
  });
});
