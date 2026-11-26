import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyDirectMessage,
  notifyGroupMessage,
} from "./message-notifications";
import {
  createNotification,
  createNotificationsForUsers,
  listTenantStaffUserIds,
} from "@/lib/notifications/create-notification";

vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: vi.fn(async () => null),
  createNotificationsForUsers: vi.fn(async () => 1),
  listTenantStaffUserIds: vi.fn(async () => ["admin"]),
}));

function database(role = "worker", userId: string | null = "recipient") {
  const calls: { table: string; filters: unknown[][] }[] = [];
  const from = vi.fn((table: string) => {
    const filters: unknown[][] = [];
    calls.push({ table, filters });
    const data =
      table === "worker"
        ? { user_id: userId }
        : table === "tenants"
          ? { slug: "clinic" }
          : { role };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((...args: unknown[]) => {
        filters.push(args);
        return query;
      }),
      in: vi.fn((...args: unknown[]) => {
        filters.push(args);
        return query;
      }),
      maybeSingle: vi.fn(async () => ({ data, error: null })),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data:
            table === "group_members"
              ? [{ user_id: "worker-sender" }, { user_id: "worker-recipient" }]
              : [
                  { user_id: userId },
                  { user_id: userId },
                  { user_id: "sender" },
                  { user_id: null },
                ],
          error: null,
        }).then(resolve),
    };
    return query;
  });
  return { supabase: { from } as never, calls, from };
}
const direct = {
  tenantId: "tenant",
  workerId: "worker",
  senderUserId: "sender",
  senderRole: "recruiter" as const,
  body: "Hello",
};

describe("message notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["candidate", "worker"])(
    "routes admin messages to the %s portal with tenant context",
    async (role) => {
      const db = database(role);
      await notifyDirectMessage(db.supabase, direct);
      expect(createNotification).toHaveBeenCalledWith(
        db.supabase,
        expect.objectContaining({
          tenantId: "tenant",
          userId: "recipient",
          type: "direct_message",
          body: "Hello",
          link:
            role === "candidate"
              ? "/application/candidate/messages?tenant=clinic"
              : "/application/applicant-dashboard/group-chat?tab=recruiter&tenant=clinic",
        }),
      );
      for (const call of db.calls.filter((c) => c.table !== "tenants"))
        expect(call.filters).toContainEqual(["tenant_id", "tenant"]);
    },
  );

  it("notifies tenant staff of a reply and excludes the sender", async () => {
    const db = database();
    await notifyDirectMessage(db.supabase, {
      ...direct,
      senderRole: "applicant",
    });
    expect(listTenantStaffUserIds).toHaveBeenCalledWith(db.supabase, "tenant", [
      "sender",
    ]);
    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      db.supabase,
      expect.objectContaining({
        userIds: ["admin"],
        link: "/admin_recruiter/messages?workerId=worker",
      }),
    );
  });

  it("includes a preview for attachment-only messages", async () => {
    const db = database();
    await notifyDirectMessage(db.supabase, {
      ...direct,
      body: "",
      attachmentName: "resume.pdf",
    });
    expect(createNotification).toHaveBeenCalledWith(
      db.supabase,
      expect.objectContaining({ body: "Attachment: resume.pdf" }),
    );
  });

  it.each([null, "sender"])(
    "skips unlinked workers and self notifications (%s)",
    async (userId) => {
      await notifyDirectMessage(database("worker", userId).supabase, direct);
      expect(createNotification).not.toHaveBeenCalled();
    },
  );

  it("maps group worker IDs to auth IDs, deduplicates and excludes the sender", async () => {
    const db = database();
    await notifyGroupMessage(db.supabase, {
      tenantId: "tenant",
      groupId: "group",
      groupName: "Team",
      senderUserId: "sender",
      senderWorkerId: "worker-sender",
      body: "Hi team",
    });
    expect(db.calls.find((c) => c.table === "worker")?.filters).toContainEqual([
      "id",
      ["worker-recipient"],
    ]);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      db.supabase,
      expect.objectContaining({
        userId: "recipient",
        link: "/application/applicant-dashboard/group-chat?tab=group&group=group&tenant=clinic",
      }),
    );
    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      db.supabase,
      expect.objectContaining({
        userIds: ["admin"],
        link: "/admin_recruiter/messages?tab=group&group=group",
      }),
    );
    for (const call of db.calls.filter((c) => c.table !== "tenants"))
      expect(call.filters).toContainEqual(["tenant_id", "tenant"]);
  });

  it("keeps a saved send successful when notification infrastructure fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = database();
    db.from.mockImplementation(() => {
      throw new Error("Unavailable");
    });
    await expect(
      notifyDirectMessage(db.supabase, direct),
    ).resolves.toBeUndefined();
    await expect(
      notifyGroupMessage(db.supabase, {
        tenantId: "tenant",
        groupId: "group",
        groupName: "Team",
        senderUserId: "sender",
        body: "Hi",
      }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
