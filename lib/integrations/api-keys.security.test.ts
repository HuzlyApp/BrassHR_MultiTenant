import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createTenantApiKey, generateInboundApiKey, listTenantApiKeys, revokeTenantApiKey, verifyInboundApiKey } from "./api-keys";

function database(data: unknown, error: unknown = null, tenant: unknown = { id: "tenant-a", is_active: true }) {
  const result = { data, error };
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), order: vi.fn(), insert: vi.fn(), update: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), single: vi.fn().mockResolvedValue(result), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of [query.select, query.eq, query.is, query.order, query.insert, query.update]) method.mockReturnValue(query);
  const tenantQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: tenant, error: null }) };
  tenantQuery.select.mockReturnValue(tenantQuery);
  tenantQuery.eq.mockImplementation((column, value) => {
    if (column === "is_active" && value === true && (tenant as { is_active?: boolean } | null)?.is_active !== true) {
      tenantQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    }
    return tenantQuery;
  });
  const from = vi.fn((table: string) => table === "tenants" ? tenantQuery : query);
  return { client: { from } as unknown as SupabaseClient, from, query, tenantQuery };
}
const row = { id: "key-a", tenant_id: "tenant-a", scopes: ["inbound"], revoked_at: null };

describe("API key storage and lifecycle", () => {
  it("stores only a SHA-256 digest and returns the secret once", async () => {
    const db = database(row);
    const created = await createTenantApiKey(db.client, { tenantId: "tenant-a", name: " Test ", createdByUserId: "user-a" });
    const inserted = db.query.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({ tenant_id: "tenant-a", name: "Test", key_hash: createHash("sha256").update(created.apiKey).digest("hex") });
    expect(JSON.stringify(inserted)).not.toContain(created.apiKey);
    expect(created).not.toHaveProperty("keyHash");
  });
  it.each(["", "  ", "a".repeat(121)])("rejects invalid names", async (name) => {
    const db = database(row);
    await expect(createTenantApiKey(db.client, { tenantId: "tenant-a", name, createdByUserId: null })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("lists metadata only within the selected tenant", async () => {
    const db = database([{ ...row, key_hash: "sensitive" }]);
    const keys = await listTenantApiKeys(db.client, "tenant-a");
    expect(db.query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(db.query.select.mock.calls[0][0]).not.toContain("key_hash");
    expect(JSON.stringify(keys)).not.toContain("sensitive");
  });
  it("revokes only active keys belonging to the selected tenant", async () => {
    const db = database(null);
    expect(await revokeTenantApiKey(db.client, { tenantId: "tenant-a", keyId: "key-b" })).toBeNull();
    expect(db.query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(db.query.eq).toHaveBeenCalledWith("id", "key-b");
    expect(db.query.is).toHaveBeenCalledWith("revoked_at", null);
  });
  it.each(["", "wrong", "bhr_in_" + "a".repeat(13), "bhr_in_" + "a".repeat(33), "bhr_in_" + "!".repeat(32)])("rejects malformed keys without querying", async (secret) => {
    const db = database(null);
    expect(await verifyInboundApiKey(db.client, secret)).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("looks up the exact digest and excludes revoked keys", async () => {
    const db = database(row);
    const generated = generateInboundApiKey();
    expect(await verifyInboundApiKey(db.client, generated.apiKey)).toMatchObject({ tenantId: "tenant-a" });
    expect(db.query.eq).toHaveBeenCalledWith("key_hash", generated.keyHash);
    expect(db.query.is).toHaveBeenCalledWith("revoked_at", null);
  });
  it.each([null, { id: "tenant-a", is_active: false }])("rejects keys for missing or disabled tenants", async (tenant) => {
    const db = database(row, null, tenant);
    expect(await verifyInboundApiKey(db.client, generateInboundApiKey().apiKey)).toBeNull();
  });
  it.each([null, undefined, "inbound", [null], [{ toString: () => "inbound" }]])("does not grant access for corrupt scopes %j", async (scopes) => {
    const db = database({ ...row, scopes });
    const verified = await verifyInboundApiKey(db.client, generateInboundApiKey().apiKey);
    expect(verified?.scopes ?? []).not.toContain("inbound");
  });
  it("propagates lookup errors rather than authorizing", async () => {
    const db = database(null, new Error("offline"));
    await expect(verifyInboundApiKey(db.client, generateInboundApiKey().apiKey)).rejects.toThrow("offline");
  });
  it("fails closed if tenant status cannot be read", async () => {
    const db = database(row);
    db.tenantQuery.maybeSingle.mockRejectedValueOnce(new Error("tenant lookup unavailable"));
    await expect(verifyInboundApiKey(db.client, generateInboundApiKey().apiKey)).rejects.toThrow("tenant lookup unavailable");
  });
});
