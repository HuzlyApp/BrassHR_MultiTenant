import { afterEach, describe, expect, it, vi } from "vitest";
import { initiateDialpadCall, listDialpadUsers, parseDialpadCaller } from "@/lib/dialpad/client";

describe("Dialpad client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a safe integer user id as a string", () => {
    expect(
      parseDialpadCaller({
        id: 4943251099926528,
        display_name: "Alex Recruiter",
        emails: ["alex@example.com"],
        phone_numbers: ["+14155550100"],
        is_online: true,
      })
    ).toEqual({
      id: "4943251099926528",
      name: "Alex Recruiter",
      emails: ["alex@example.com"],
      phones: ["+14155550100"],
      online: true,
    });
  });

  it("lists users and follows the cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "11", display_name: "Zoe" }],
          cursor: "next",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "10", first_name: "Alex", last_name: "Ng" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const callers = await listDialpadUsers("test-key");

    expect(callers.map((caller) => caller.name)).toEqual(["Alex Ng", "Zoe"]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ href: "https://dialpad.com/api/v2/users?cursor=next" }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("sends the ring-all-devices call with a numeric user id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ call_id: 987654321 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await initiateDialpadCall("test-key", {
      phoneNumber: "+14155550123",
      userId: "4943251099926528",
    });

    expect(result).toEqual({ callId: "987654321" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dialpad.com/api/v2/call",
      expect.objectContaining({
        method: "POST",
        body: '{"phone_number":"+14155550123","user_id":4943251099926528}',
      })
    );
  });

  it("surfaces Dialpad's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: "No active device." } }),
      })
    );

    await expect(
      initiateDialpadCall("test-key", { phoneNumber: "+14155550123", userId: "12" })
    ).rejects.toMatchObject({ message: "No active device.", status: 400 });
  });
});
