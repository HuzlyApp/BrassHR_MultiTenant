import { describe, expect, it } from "vitest";
import {
  buildCommunicationThreads,
  buildConversationId,
  contactEmailFromRow,
  contactPhoneFromRow,
  defaultReplySubject,
  normalizeEmailSubject,
  phonesMatch,
} from "@/lib/communication/conversation";
import type { CandidateCommunicationRow } from "@/lib/communication/record";

const workerId = "55222b69-9839-4b9b-9642-be80a0ea58e5";

function emailRow(partial: Partial<CandidateCommunicationRow> & { id: string; created_at: string }): CandidateCommunicationRow {
  return {
    id: partial.id,
    channel: "email",
    recipient: partial.recipient ?? "clelipan@up.edu.ph",
    subject: partial.subject ?? null,
    body: partial.body ?? "",
    provider_message_id: partial.provider_message_id ?? null,
    status: partial.status ?? "sent",
    direction: partial.direction ?? "outbound",
    error_message: null,
    created_at: partial.created_at,
    sent_by_user_id: partial.sent_by_user_id ?? null,
    conversation_id: partial.conversation_id ?? buildConversationId(workerId, "email"),
    contact_email: partial.contact_email ?? "clelipan@up.edu.ph",
    from_email: partial.from_email ?? null,
    to_email: partial.to_email ?? null,
    body_html: partial.body_html ?? null,
    in_reply_to: partial.in_reply_to ?? null,
    email_references: partial.email_references ?? null,
    normalized_subject: partial.normalized_subject ?? null,
  };
}

function smsRow(partial: Partial<CandidateCommunicationRow> & { id: string; created_at: string }): CandidateCommunicationRow {
  return {
    id: partial.id,
    channel: "sms",
    recipient: partial.recipient ?? "+19197043877",
    subject: partial.subject ?? null,
    body: partial.body ?? "",
    provider_message_id: partial.provider_message_id ?? null,
    status: partial.status ?? "sent",
    direction: partial.direction ?? "outbound",
    error_message: partial.error_message ?? null,
    created_at: partial.created_at,
    sent_by_user_id: partial.sent_by_user_id ?? null,
    conversation_id: partial.conversation_id ?? buildConversationId(workerId, "sms"),
    contact_email: null,
    from_email: null,
    to_email: null,
    body_html: null,
    in_reply_to: null,
    email_references: null,
    normalized_subject: null,
  };
}

describe("normalizeEmailSubject", () => {
  it("strips Re: prefixes", () => {
    expect(normalizeEmailSubject("Re: bitch")).toBe("bitch");
    expect(normalizeEmailSubject("Re: Re: Hello")).toBe("hello");
  });
});

describe("contactEmailFromRow", () => {
  it("uses from_email for inbound", () => {
    expect(
      contactEmailFromRow({
        channel: "email",
        direction: "inbound",
        from_email: "clelipan@up.edu.ph",
        to_email: "notifications@brasshr.com",
        recipient: "clelipan@up.edu.ph",
        contact_email: "clelipan@up.edu.ph",
      })
    ).toBe("clelipan@up.edu.ph");
  });

  it("uses to_email for outbound", () => {
    expect(
      contactEmailFromRow({
        channel: "email",
        direction: "outbound",
        from_email: "notifications@brasshr.com",
        to_email: "clelipan@up.edu.ph",
        recipient: "clelipan@up.edu.ph",
        contact_email: "clelipan@up.edu.ph",
      })
    ).toBe("clelipan@up.edu.ph");
  });
});

describe("phonesMatch", () => {
  it("matches formatted and E.164 numbers", () => {
    expect(phonesMatch("+19197043877", "(919) 704-3877")).toBe(true);
    expect(phonesMatch("+19197043877", "+15551234567")).toBe(false);
  });
});

describe("buildCommunicationThreads", () => {
  it("groups outbound and inbound emails into one conversation", () => {
    const rows = [
      emailRow({
        id: "1",
        direction: "outbound",
        subject: "bitch",
        from_email: "notifications@brasshr.com",
        to_email: "clelipan@up.edu.ph",
        body: "hello bitch!",
        created_at: "2026-06-10T18:01:06Z",
        sent_by_user_id: "user-1",
      }),
      emailRow({
        id: "2",
        direction: "inbound",
        subject: "Re: bitch",
        status: "received",
        from_email: "clelipan@up.edu.ph",
        to_email: "notifications@brasshr.com",
        body: "reply body",
        created_at: "2026-06-10T18:19:45Z",
        sent_by_user_id: null,
      }),
    ];

    const threads = buildCommunicationThreads(rows, workerId, { email: "clelipan@up.edu.ph" });
    expect(threads).toHaveLength(1);
    expect(threads[0].channel).toBe("email");
    expect(threads[0].messageCount).toBe(2);
    expect(threads[0].messages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(threads[0].rootSubject).toBe("bitch");
    expect(threads[0].latestSubject).toBe("Re: bitch");
    expect(threads[0].latestStatus).toBe("received");
    expect(threads[0].unreadCount).toBe(1);
  });

  it("groups multiple outbound emails with different subjects into one email conversation", () => {
    const rows = [
      emailRow({
        id: "1",
        subject: "bitch",
        body: "first",
        created_at: "2026-06-10T18:01:06Z",
      }),
      emailRow({
        id: "2",
        subject: "Follow up",
        body: "second",
        created_at: "2026-06-10T19:01:06Z",
      }),
      emailRow({
        id: "3",
        subject: "Re: bitch",
        direction: "inbound",
        status: "received",
        body: "reply",
        created_at: "2026-06-10T20:01:06Z",
      }),
    ];

    const threads = buildCommunicationThreads(rows, workerId, { email: "clelipan@up.edu.ph" });
    expect(threads.filter((t) => t.channel === "email")).toHaveLength(1);
    expect(threads[0].messageCount).toBe(3);
    expect(threads[0].latestPreview).toBe("reply");
  });

  it("groups multiple SMS messages including failed ones into one SMS conversation", () => {
    const rows = [
      smsRow({
        id: "s1",
        body: "Hello",
        status: "sent",
        created_at: "2026-06-10T18:01:06Z",
      }),
      smsRow({
        id: "s2",
        body: "Failed attempt",
        status: "failed",
        error_message: "Twilio error",
        created_at: "2026-06-10T18:05:06Z",
      }),
      smsRow({
        id: "s3",
        body: "Applicant reply",
        direction: "inbound",
        status: "received",
        created_at: "2026-06-10T18:10:06Z",
      }),
    ];

    const threads = buildCommunicationThreads(rows, workerId, { phone: "+19197043877" });
    expect(threads.filter((t) => t.channel === "sms")).toHaveLength(1);
    expect(threads[0].messageCount).toBe(3);
    expect(threads[0].latestStatus).toBe("received");
    expect(threads[0].contactPhone).toBe("+19197043877");
  });

  it("produces one email card and one SMS card for mixed communications", () => {
    const rows = [
      emailRow({ id: "e1", body: "email one", created_at: "2026-06-10T18:01:06Z" }),
      emailRow({ id: "e2", body: "email two", created_at: "2026-06-10T18:02:06Z" }),
      smsRow({ id: "s1", body: "sms one", created_at: "2026-06-10T18:03:06Z" }),
      smsRow({ id: "s2", body: "sms two", created_at: "2026-06-10T18:04:06Z" }),
    ];

    const threads = buildCommunicationThreads(rows, workerId, {
      email: "clelipan@up.edu.ph",
      phone: "+19197043877",
    });

    expect(threads).toHaveLength(2);
    expect(threads.find((t) => t.channel === "email")?.messageCount).toBe(2);
    expect(threads.find((t) => t.channel === "sms")?.messageCount).toBe(2);
  });

  it("matches SMS by normalized phone when recipient format differs", () => {
    const rows = [
      smsRow({
        id: "s1",
        recipient: "(919) 704-3877",
        body: "formatted phone",
        created_at: "2026-06-10T18:01:06Z",
      }),
    ];

    const threads = buildCommunicationThreads(rows, workerId, { phone: "+19197043877" });
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(1);
  });

  it("defaults reply subject from latest thread subject", () => {
    const rows = [
      emailRow({
        id: "1",
        subject: "bitch",
        created_at: "2026-06-10T18:01:06Z",
      }),
      emailRow({
        id: "2",
        subject: "Re: bitch",
        direction: "inbound",
        status: "received",
        created_at: "2026-06-10T18:19:45Z",
      }),
    ];
    const [thread] = buildCommunicationThreads(rows, workerId, { email: "clelipan@up.edu.ph" });
    expect(defaultReplySubject(thread)).toBe("Re: bitch");
  });
});

describe("contactPhoneFromRow", () => {
  it("normalizes recipient phone", () => {
    expect(contactPhoneFromRow({ channel: "sms", direction: "inbound", recipient: "(919) 704-3877" })).toBe(
      "+19197043877"
    );
  });
});

describe("buildConversationId", () => {
  it("is stable for the same worker and channel", () => {
    expect(buildConversationId(workerId, "email")).toBe(buildConversationId(workerId, "email"));
    expect(buildConversationId(workerId, "email")).not.toBe(buildConversationId(workerId, "sms"));
  });
});

describe("conversation summary updates", () => {
  it("updates latest preview and status when a new outbound email is appended", () => {
    const initial = [
      emailRow({ id: "1", body: "first", status: "sent", created_at: "2026-06-10T18:01:06Z" }),
    ];
    const updated = [
      ...initial,
      emailRow({ id: "2", body: "newest outbound", status: "sent", created_at: "2026-06-10T19:01:06Z" }),
    ];

    const [before] = buildCommunicationThreads(initial, workerId, { email: "clelipan@up.edu.ph" });
    const [after] = buildCommunicationThreads(updated, workerId, { email: "clelipan@up.edu.ph" });

    expect(before.messageCount).toBe(1);
    expect(after.messageCount).toBe(2);
    expect(after.latestPreview).toBe("newest outbound");
    expect(after.latestStatus).toBe("sent");
  });

  it("updates latest preview when a new SMS is appended", () => {
    const initial = [smsRow({ id: "1", body: "first sms", created_at: "2026-06-10T18:01:06Z" })];
    const updated = [
      ...initial,
      smsRow({ id: "2", body: "second sms", created_at: "2026-06-10T19:01:06Z" }),
    ];

    const [after] = buildCommunicationThreads(updated, workerId, { phone: "+19197043877" });
    expect(after.messageCount).toBe(2);
    expect(after.latestPreview).toBe("second sms");
  });
});
