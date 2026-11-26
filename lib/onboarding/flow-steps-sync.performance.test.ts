import { describe, expect, it, vi } from "vitest";
import { createDefaultWorkflowState } from "./default-workflow";
import { builderDraftToFlowStepInserts, replaceFlowStepsFromDraft } from "./flow-steps-sync";

function database(deleteError: unknown = null, insertError: unknown = null) {
  const eq = vi.fn(async () => ({ error: deleteError }));
  const insert = vi.fn(async () => ({ error: insertError }));
  const from = vi.fn(() => ({ delete: () => ({ eq }), insert }));
  return { client: { from } as never, from, eq, insert };
}
describe("workflow step batch save", () => {
  it("saves every parent in one insert with unique IDs and no follow-up updates", async () => {
    const draft = createDefaultWorkflowState();
    expect(draft.nodes.length).toBeGreaterThan(2);
    draft.edges = [
      { id: "branch-a", source: draft.nodes[0].id, target: draft.nodes[1].id },
      { id: "branch-b", source: draft.nodes[0].id, target: draft.nodes[2].id },
    ];
    const expected = builderDraftToFlowStepInserts("flow-a", draft);
    const db = database();
    await replaceFlowStepsFromDraft(db.client, "flow-a", draft);
    const rows = db.insert.mock.calls[0][0] as unknown as Array<Record<string, unknown>>;
    expect(db.from).toHaveBeenCalledTimes(2);
    expect(db.eq).toHaveBeenCalledWith("flow_id", "flow-a");
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(draft.nodes.length);
    const ids = new Map(rows.map((row) => [row.canvas_node_id, row.id]));
    expect(new Set(ids.values()).size).toBe(rows.length);
    rows.forEach((row, i) => {
      expect(row).toMatchObject({ ...expected[i], parent_step_id: row.parent_step_id });
      expect(row.id).toMatch(/^[0-9a-f-]{36}$/i);
      const parent = expected[i].metadata.parent_canvas_node_id;
      expect(row.parent_step_id).toBe(parent ? ids.get(parent) : null);
    });
  });
  it("clears an empty workflow without making an insert", async () => {
    const db = database();
    await replaceFlowStepsFromDraft(db.client, "flow-a", { nodes: [], edges: [] });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("stops after a failed delete and reports a failed batch insert", async () => {
    const draft = createDefaultWorkflowState();
    const db = database({ message: "delete rejected" });
    await expect(replaceFlowStepsFromDraft(db.client, "flow-a", draft)).rejects.toThrow("delete rejected");
    expect(db.insert).not.toHaveBeenCalled();
    const insertFailure = database(null, { message: "insert rejected" });
    await expect(replaceFlowStepsFromDraft(insertFailure.client, "flow-a", draft)).rejects.toThrow("insert rejected");
  });
});
