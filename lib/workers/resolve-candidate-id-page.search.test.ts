import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCandidateIdPage } from "@/lib/workers/resolve-candidate-id-page";
import { parseCandidateListQueryParams } from "@/lib/workers/candidate-list-params";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("resolveCandidateIdPage search", () => {
  const rpc = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  function mockIdentityRows(
    rows: Array<{
      id: string;
      email?: string | null;
      phone?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    }>
  ) {
    from.mockImplementation(() => {
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      builder.range = vi.fn(async () => ({ data: rows, error: null, count: rows.length }));
      // queryInChunks awaits the builder as a thenable via the final await query
      Object.assign(builder, {
        then: undefined,
      });
      // Supabase query is thenable; make the builder resolve like a PostgrestBuilder.
      (builder as { then?: unknown }).then = (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      return builder;
    });
  }

  function supabase(): SupabaseClient {
    return { rpc, from } as unknown as SupabaseClient;
  }

  it("passes normalized free-text and skills to list_candidate_ids_page", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: "11111111-1111-1111-1111-111111111111", total_count: 2 },
        { id: "22222222-2222-2222-2222-222222222222", total_count: 2 },
      ],
      error: null,
    });
    mockIdentityRows([
      {
        id: "11111111-1111-1111-1111-111111111111",
        email: "a@example.com",
        phone: "1111111111",
        first_name: "Jane",
        last_name: "Doe",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        email: "b@example.com",
        phone: "2222222222",
        first_name: "John",
        last_name: "Doe",
      },
    ]);

    const params = parseCandidateListQueryParams(
      new URLSearchParams({
        q: "  Jane Doe  ",
        skills: "ICU, BLS",
        limit: "25",
        offset: "0",
      })
    );

    const page = await resolveCandidateIdPage(supabase(), "tenant-a", params);
    expect(page.usedRpc).toBe(true);
    expect(page.total).toBe(2);
    expect(page.ids).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith(
      "list_candidate_ids_page",
      expect.objectContaining({
        p_tenant_id: "tenant-a",
        p_search: "Jane Doe",
        p_skills: ["ICU", "BLS"],
        p_limit: 500,
        p_offset: 0,
      })
    );
  });

  it("dedupes matching worker rows into unique candidate profiles before paging", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", total_count: 2 },
        { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", total_count: 2 },
      ],
      error: null,
    });
    mockIdentityRows([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email: "same@example.com",
        phone: "5551112222",
        first_name: "Sam",
        last_name: "Same",
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email: "",
        phone: "5551112222",
        first_name: "Sam",
        last_name: "Same",
      },
    ]);

    const page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ q: "Sam", limit: "25", offset: "0" }))
    );
    expect(page.total).toBe(1);
    expect(page.ids).toEqual(["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]);
  });

  it("supports email, phone, and no-result searches", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", total_count: 1 }],
      error: null,
    });
    mockIdentityRows([
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        email: "nurse@example.com",
        phone: null,
        first_name: "Nurse",
        last_name: "One",
      },
    ]);
    let page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ q: "nurse@example.com" }))
    );
    expect(page.total).toBe(1);
    expect(rpc.mock.calls[0][1].p_search).toBe("nurse@example.com");

    rpc.mockResolvedValueOnce({
      data: [{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", total_count: 1 }],
      error: null,
    });
    mockIdentityRows([
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email: "phone@example.com",
        phone: "5551112222",
        first_name: "Phone",
        last_name: "User",
      },
    ]);
    page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ q: "(555) 111-2222" }))
    );
    expect(page.total).toBe(1);
    expect(rpc.mock.calls[1][1].p_search).toBe("555 111-2222");

    rpc.mockResolvedValueOnce({ data: [], error: null });
    page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ q: "zzznomatch" }))
    );
    expect(page.ids).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("keeps tenants scoped via p_tenant_id", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await resolveCandidateIdPage(
      supabase(),
      "tenant-b",
      parseCandidateListQueryParams(new URLSearchParams({ q: "alice" }))
    );
    expect(rpc.mock.calls[0][1].p_tenant_id).toBe("tenant-b");
  });

  it("applies unique-profile offset after fetching matching worker ids", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: "11111111-1111-1111-1111-111111111111", total_count: 2 },
        { id: "22222222-2222-2222-2222-222222222222", total_count: 2 },
      ],
      error: null,
    });
    mockIdentityRows([
      {
        id: "11111111-1111-1111-1111-111111111111",
        email: "a@example.com",
        first_name: "A",
        last_name: "One",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        email: "b@example.com",
        first_name: "B",
        last_name: "Two",
      },
    ]);
    const page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(
        new URLSearchParams({ q: "nurse", skills: "ICU", limit: "25", offset: "1" })
      )
    );
    expect(page.total).toBe(2);
    expect(page.ids).toEqual(["22222222-2222-2222-2222-222222222222"]);
    expect(rpc.mock.calls[0][1].p_offset).toBe(0);
    expect(rpc.mock.calls[0][1].p_search).toBe("nurse");
    expect(rpc.mock.calls[0][1].p_skills).toEqual(["ICU"]);
  });

  it("fails closed when search is active and RPC is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function missing" } });
    await expect(
      resolveCandidateIdPage(
        supabase(),
        "tenant-a",
        parseCandidateListQueryParams(new URLSearchParams({ q: "shawnda" }))
      )
    ).rejects.toThrow(/unavailable/i);
  });

  it("retries once on PostgREST schema cache miss then succeeds", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the function public.list_candidate_ids_page in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [{ id: "11111111-1111-1111-1111-111111111111", total_count: 1 }],
        error: null,
      });
    mockIdentityRows([
      {
        id: "11111111-1111-1111-1111-111111111111",
        email: "shawnda@example.com",
        first_name: "Shawnda",
        last_name: "Watkins",
      },
    ]);
    const page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ q: "shawnda" }))
    );
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(page.usedRpc).toBe(true);
    expect(page.total).toBe(1);
  });

  it("fails closed when search is active without a tenant", async () => {
    await expect(
      resolveCandidateIdPage(
        supabase(),
        null,
        parseCandidateListQueryParams(new URLSearchParams({ skills: "ICU" }))
      )
    ).rejects.toThrow(/tenant workspace/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows unfiltered fallback when no search filters are set", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function missing" } });
    const rows = [
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        email: "fallback@example.com",
        first_name: "Fall",
        last_name: "Back",
      },
    ];
    from.mockImplementation(() => {
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.in = vi.fn(() => builder);
      builder.order = vi.fn(() => builder);
      builder.range = vi.fn(async () => ({
        data: [{ id: rows[0].id }],
        error: null,
        count: 1,
      }));
      (builder as { then?: unknown }).then = (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) =>
        Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
      return builder;
    });
    const page = await resolveCandidateIdPage(
      { rpc, from } as unknown as SupabaseClient,
      "tenant-a",
      parseCandidateListQueryParams(new URLSearchParams({ limit: "25", offset: "0" }))
    );
    expect(page.usedRpc).toBe(false);
    expect(page.ids).toEqual(["dddddddd-dddd-dddd-dddd-dddddddddddd"]);
    expect(page.total).toBe(1);
  });
});
