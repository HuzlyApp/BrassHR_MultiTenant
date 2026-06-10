import { describe, expect, it, vi } from "vitest";
import { resolveWorkerByEmail } from "@/lib/communication/resolve-worker-by-email";

type QueryResult = { data: unknown; error: null };

function makeChain(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.in = vi.fn(self);
  builder.not = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

describe("resolveWorkerByEmail", () => {
  it("finds worker by legacy @nexusmedpro.com when querying new @brasshr.com address", async () => {
    const workerChain = makeChain({
      data: { id: "w1", tenant_id: "t1", email: "john@nexusmedpro.com" },
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker") return workerChain;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const match = await resolveWorkerByEmail(supabase as never, "john@brasshr.com");

    expect(match?.id).toBe("w1");
    expect(workerChain.in).toHaveBeenCalledWith(
      "email",
      expect.arrayContaining(["john@brasshr.com", "john@nexusmedpro.com"])
    );
  });

  it("falls back to linked worker via users.email variants", async () => {
    const workerMiss = makeChain({ data: null, error: null });
    const workerHit = makeChain({
      data: { id: "w2", tenant_id: "t1", email: null },
      error: null,
    });

    const usersBuilder: Record<string, unknown> = {};
    const usersSelf = () => usersBuilder;
    usersBuilder.select = vi.fn(usersSelf);
    usersBuilder.in = vi.fn(usersSelf);
    usersBuilder.limit = vi.fn(async () => ({
      data: [{ id: "u1", email: "jane@nexusmedpro.com" }],
      error: null,
    }));

    let workerCall = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker") return ++workerCall === 1 ? workerMiss : workerHit;
        if (table === "users") return usersBuilder;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const match = await resolveWorkerByEmail(supabase as never, "jane@brasshr.com");
    expect(match?.id).toBe("w2");
  });

  it("returns null for unrelated external domains", async () => {
    const workerMiss = makeChain({ data: null, error: null });
    const usersMiss = makeChain({ data: [], error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "worker") return workerMiss;
        if (table === "users") return usersMiss;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    expect(await resolveWorkerByEmail(supabase as never, "other@gmail.com")).toBeNull();
  });
});
