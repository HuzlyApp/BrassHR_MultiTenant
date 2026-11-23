import { beforeEach, describe, expect, it, vi } from "vitest";
import { duplicateOnboardingFlow, updateOnboardingFlow } from "./onboarding-flows";
const mocks = vi.hoisted(() => ({ draft: { nodes: [{ id: "node-a" }], edges: [] }, replace: vi.fn() }));
vi.mock("./flow-steps-sync", () => ({ loadFlowBuilderDraft: async () => mocks.draft, replaceFlowStepsFromDraft: mocks.replace }));
const source = { id: "flow-a", tenant_id: "tenant-a", name: "Nursing W2", library_id: "folder-a", template_id: null, status: "published", created_as_blank: true, builder_draft: {}, profession_id: "profession-a", employment_type: "W2" };
function db(found = true) {
  const calls: Array<[string, ...unknown[]]> = [];
  let selected = ""; let patch: Record<string, unknown> | null = null;
  const q = new Proxy({}, { get: (_, method: string) => {
    if (method === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ name: source.name }, { name: `${source.name} (copy)` }], error: null }).then(resolve);
    if (method === "maybeSingle") return async () => ({ data: found ? source : null, error: null });
    if (method === "single") return async () => ({ data: { ...source, ...patch, id: selected === "copy" ? "copy-a" : "flow-a" }, error: null });
    return (...args: unknown[]) => { calls.push([method, ...args]); if (method === "insert") { patch = args[0] as Record<string, unknown>; selected = "copy"; } if (method === "update") patch = args[0] as Record<string, unknown>; return q; };
  } });
  return { client: { from: (table: string) => { calls.push(["from", table]); return q; } } as never, calls };
}
beforeEach(() => vi.clearAllMocks());
describe("workflow configuration actions", () => {
  it("duplicates tenant configuration into a uniquely named unpublished flow without copying candidate progress", async () => {
    const { client, calls } = db();
    expect(await duplicateOnboardingFlow(client, "tenant-a", "flow-a", "staff-a")).toMatchObject({ id: "copy-a", name: "Nursing W2 (copy 2)", status: "unpublished", employmentType: "W2", professionId: "profession-a" });
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls.find(([method]) => method === "insert")?.[1]).toMatchObject({ tenant_id: "tenant-a", builder_draft: mocks.draft, created_by: "staff-a" });
    expect(mocks.replace).toHaveBeenCalledWith(client, "copy-a", mocks.draft);
    expect(calls.filter(([method]) => method === "from").every(([, table]) => table === "onboarding_flows")).toBe(true);
  });
  it("does not copy an unavailable or foreign flow", async () => {
    const { client, calls } = db(false);
    await expect(duplicateOnboardingFlow(client, "tenant-a", "foreign-flow", "staff-a")).rejects.toThrow("Flow not found");
    expect(calls.some(([method]) => method === "insert")).toBe(false);
  });
  it("unpublishes with tenant and flow filters without changing candidate instances or the draft", async () => {
    const { client, calls } = db();
    expect(await updateOnboardingFlow(client, "tenant-a", "flow-a", { status: "unpublished", updatedBy: "staff-a" })).toMatchObject({ status: "unpublished" });
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["eq", "id", "flow-a"]);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
