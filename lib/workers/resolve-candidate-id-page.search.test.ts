import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCandidateIdPage } from "@/lib/workers/resolve-candidate-id-page";
import { parseCandidateListQueryParams } from "@/lib/workers/candidate-list-params";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("resolveCandidateIdPage search", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
  });

  function supabase(): SupabaseClient {
    return { rpc } as unknown as SupabaseClient;
  }

  it("passes normalized free-text and skills to list_candidate_ids_page", async () => {
    rpc.mockResolvedValue({
      data: [
        { id: "11111111-1111-1111-1111-111111111111", total_count: 2 },
        { id: "22222222-2222-2222-2222-222222222222", total_count: 2 },
      ],
      error: null,
    });

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
        p_limit: 25,
        p_offset: 0,
      })
    );
  });

  it("supports email, phone, and no-result searches", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", total_count: 1 }],
      error: null,
    });
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

  it("preserves pagination offset after search", async () => {
    rpc.mockResolvedValue({
      data: [{ id: "cccccccc-cccc-cccc-cccc-cccccccccccc", total_count: 40 }],
      error: null,
    });
    const page = await resolveCandidateIdPage(
      supabase(),
      "tenant-a",
      parseCandidateListQueryParams(
        new URLSearchParams({ q: "nurse", skills: "ICU", limit: "25", offset: "25" })
      )
    );
    expect(page.total).toBe(40);
    expect(rpc.mock.calls[0][1].p_offset).toBe(25);
    expect(rpc.mock.calls[0][1].p_search).toBe("nurse");
    expect(rpc.mock.calls[0][1].p_skills).toEqual(["ICU"]);
  });
});
