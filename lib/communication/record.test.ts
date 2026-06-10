import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildConversationId } from "@/lib/communication/conversation";
import {
  listCandidateCommunications,
  listCandidateCommunicationsWithThreads,
  recordCandidateCommunication,
} from "@/lib/communication/record";

vi.mock("@/lib/cache", () => ({
  invalidateResourceCache: vi.fn(),
  invalidateTenantCache: vi.fn(),
}));

const workerId = "55222b69-9839-4b9b-9642-be80a0ea58e5";

describe("listCandidateCommunications", () => {
  it("always reads fresh from the database (no response cache)", async () => {
    const rows = [
      {
        id: "1",
        channel: "email",
        recipient: "john@nexusmedpro.com",
        subject: "Old thread",
        body: "Historical message",
        body_html: null,
        provider_message_id: null,
        status: "sent",
        direction: "outbound",
        conversation_id: "conv-1",
        contact_email: "john@nexusmedpro.com",
        from_email: "notifications@brasshr.com",
        to_email: "john@nexusmedpro.com",
        in_reply_to: null,
        email_references: null,
        normalized_subject: "old thread",
        error_message: null,
        created_at: "2026-06-01T10:00:00Z",
        sent_by_user_id: "u1",
      },
      {
        id: "2",
        channel: "email",
        recipient: "john@brasshr.com",
        subject: "Re: New thread",
        body: "After migration",
        body_html: null,
        provider_message_id: "msg-2",
        status: "received",
        direction: "inbound",
        conversation_id: "conv-1",
        contact_email: "john@brasshr.com",
        from_email: "john@brasshr.com",
        to_email: "notifications@brasshr.com",
        in_reply_to: null,
        email_references: null,
        normalized_subject: "new thread",
        error_message: null,
        created_at: "2026-06-10T10:00:00Z",
        sent_by_user_id: null,
      },
    ];

    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq, order, limit });
    eq.mockReturnValue({ order, limit });
    order.mockReturnValue({ limit });
    limit.mockResolvedValue({ data: rows, error: null });

    const supabase = { from: vi.fn(() => ({ select })) };

    const result = await listCandidateCommunications(supabase as never, "worker-1");

    expect(eq).toHaveBeenCalledWith("worker_id", "worker-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toHaveLength(2);
  });
});

describe("recordCandidateCommunication", () => {
  let insertPayload: Record<string, unknown> | null;

  beforeEach(() => {
    insertPayload = null;
  });

  function mockSupabaseInsert() {
    const single = vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: {
          id: "new-row",
          channel: insertPayload?.channel,
          ...insertPayload,
        },
        error: null,
      })
    );
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
      insertPayload = payload;
      return { select };
    });
    return { from: vi.fn(() => ({ insert })) };
  }

  it("assigns outbound email to contact conversation with correct addresses", async () => {
    const supabase = mockSupabaseInsert();
    const expectedConversationId = buildConversationId(workerId, "email");

    await recordCandidateCommunication(supabase as never, {
      tenantId: "t1",
      workerId,
      sentByUserId: "user-1",
      channel: "email",
      recipient: "clelipan@up.edu.ph",
      subject: "bitch",
      body: "hello",
      status: "sent",
      direction: "outbound",
    });

    expect(insertPayload).toMatchObject({
      conversation_id: expectedConversationId,
      contact_email: "clelipan@up.edu.ph",
      from_email: "notifications@brasshr.com",
      to_email: "clelipan@up.edu.ph",
      normalized_subject: "bitch",
      direction: "outbound",
      status: "sent",
    });
  });

  it("assigns inbound reply to the same conversation", async () => {
    const supabase = mockSupabaseInsert();
    const expectedConversationId = buildConversationId(workerId, "email");

    await recordCandidateCommunication(supabase as never, {
      tenantId: "t1",
      workerId,
      sentByUserId: null,
      channel: "email",
      recipient: "clelipan@up.edu.ph",
      contactEmail: "clelipan@up.edu.ph",
      fromEmail: "clelipan@up.edu.ph",
      toEmail: "notifications@brasshr.com",
      subject: "Re: bitch",
      body: "reply body",
      status: "received",
      direction: "inbound",
    });

    expect(insertPayload).toMatchObject({
      conversation_id: expectedConversationId,
      contact_email: "clelipan@up.edu.ph",
      from_email: "clelipan@up.edu.ph",
      to_email: "notifications@brasshr.com",
      normalized_subject: "bitch",
      direction: "inbound",
      status: "received",
    });
  });
});

describe("listCandidateCommunicationsWithThreads", () => {
  it("returns sent and received emails in one thread for the contact", async () => {
    const conversationId = buildConversationId(workerId, "email");
    const rows = [
      {
        id: "1",
        channel: "email",
        recipient: "clelipan@up.edu.ph",
        subject: "bitch",
        body: "hello",
        body_html: null,
        provider_message_id: "out-1",
        status: "sent",
        direction: "outbound",
        conversation_id: conversationId,
        contact_email: "clelipan@up.edu.ph",
        from_email: "notifications@brasshr.com",
        to_email: "clelipan@up.edu.ph",
        in_reply_to: null,
        email_references: null,
        normalized_subject: "bitch",
        error_message: null,
        created_at: "2026-06-10T18:01:06Z",
        sent_by_user_id: "user-1",
      },
      {
        id: "2",
        channel: "email",
        recipient: "clelipan@up.edu.ph",
        subject: "Re: bitch",
        body: "reply",
        body_html: null,
        provider_message_id: "in-1",
        status: "received",
        direction: "inbound",
        conversation_id: conversationId,
        contact_email: "clelipan@up.edu.ph",
        from_email: "clelipan@up.edu.ph",
        to_email: "notifications@brasshr.com",
        in_reply_to: null,
        email_references: null,
        normalized_subject: "bitch",
        error_message: null,
        created_at: "2026-06-10T18:19:45Z",
        sent_by_user_id: null,
      },
    ];

    const order = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq, order, limit });
    eq.mockReturnValue({ order, limit });
    order.mockReturnValue({ limit });
    limit.mockResolvedValue({ data: rows, error: null });

    const supabase = { from: vi.fn(() => ({ select })) };

    const { communications, threads } = await listCandidateCommunicationsWithThreads(
      supabase as never,
      workerId,
      { email: "clelipan@up.edu.ph" }
    );

    expect(communications).toHaveLength(2);
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(2);
    expect(threads[0].messages.map((m) => m.id)).toEqual(["1", "2"]);
  });
});
