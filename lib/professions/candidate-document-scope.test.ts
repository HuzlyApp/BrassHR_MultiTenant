import { describe, expect, it } from "vitest";
import { listActiveProfessionDocuments, saveProfessionDocuments } from "./profession-documents";

type Row = Record<string, unknown>;
function database() {
  const rows: Record<string, Row[]> = {
    worker: [{ id: "candidate-a", tenant_id: "tenant" }, { id: "candidate-b", tenant_id: "tenant" }],
    tenant_professions: [{ id: "profession", tenant_id: "tenant", is_active: true }],
    tenant_profession_documents: [{ id: "global", tenant_id: "tenant", profession_id: "profession", worker_id: null, name: "Shared license", document_kind: "license", is_required: true, is_active: true, sort_order: 10 }],
  };
  const db = { from(table: string) {
    const filters: Array<(r: Row) => boolean> = []; let update: Row | null = null;
    const result = () => { const data = rows[table].filter(r => filters.every(f => f(r))); if (update) data.forEach(r => Object.assign(r, update)); return { data, error: null }; };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
      or: (filter: string) => { const own = filter.split("worker_id.eq.")[1]; filters.push(r => r.worker_id == null || r.worker_id === own); return q; },
      in: (k: string, values: unknown[]) => { filters.push(r => values.includes(r[k])); return q; },
      order: () => q,
      update: (row: Row) => { update = row; return q; },
      insert: async (row: Row) => { rows[table].push({ id: "custom", ...row }); return { error: null }; },
      maybeSingle: async () => ({ data: result().data[0] || null, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return q;
  } } as unknown as Parameters<typeof listActiveProfessionDocuments>[0];
  return { db, rows };
}
const custom = { name: "Private label", documentKind: "other" as const, isRequired: true, hasExpiration: true };
describe("candidate document fields", () => {
  it("keeps candidate-added labels out of other candidates and global settings", async () => {
    const { db, rows } = database();
    await saveProfessionDocuments(db, "tenant", "profession", [custom], { workerId: "candidate-a", actorIsAdmin: true });
    expect(rows.tenant_profession_documents.find(r => r.id === "custom")).toMatchObject({ worker_id: "candidate-a", has_expiration: true });
    expect((await listActiveProfessionDocuments(db, "tenant", "profession", "candidate-a")).map(d => d.name)).toContain("Private label");
    expect((await listActiveProfessionDocuments(db, "tenant", "profession", "candidate-b")).map(d => d.name)).toEqual(["Shared license"]);
    expect((await listActiveProfessionDocuments(db, "tenant", "profession")).map(d => d.name)).toEqual(["Shared license"]);
  });
  it("candidate payloads cannot edit or deactivate shared requirements", async () => {
    const { db, rows } = database();
    await saveProfessionDocuments(db, "tenant", "profession", [{ ...custom, id: "global", name: "Changed shared label", isRequired: false }], { workerId: "candidate-a", actorIsAdmin: true });
    expect(rows.tenant_profession_documents[0]).toMatchObject({ name: "Shared license", is_required: true, is_active: true });
  });
  it("rejects a foreign field before deactivating any existing requirements", async () => {
    const { db, rows } = database();
    await expect(saveProfessionDocuments(db, "tenant", "profession", [{ ...custom, id: "foreign" }], { actorIsAdmin: true })).rejects.toThrow("Document does not belong");
    expect(rows.tenant_profession_documents[0].is_active).toBe(true);
  });
  it("rejects a foreign candidate before creating fields", async () => {
    const { db } = database();
    await expect(saveProfessionDocuments(db, "wrong-tenant", "profession", [custom], { workerId: "candidate-a", actorIsAdmin: true })).rejects.toThrow("Candidate was not found");
  });
});
