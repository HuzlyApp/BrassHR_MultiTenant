import { describe, expect, it } from "vitest"
import {
  buildPipelineDetailLine,
  pipelineCheckboxLabel,
  pipelineItemIsComplete,
  pipelineSectionComplete,
  type PipelineChecklistItemRow,
} from "./worker-pipeline-checklist"

describe("worker-pipeline-checklist", () => {
  it("treats manual or sync completion as complete", () => {
    const manualRow: PipelineChecklistItemRow = {
      item_key: "bg",
      manual_completed: true,
      manual_completed_by: null,
      manual_completed_at: "2026-06-10T00:00:00.000Z",
      call_log_completed: false,
      call_log_completed_at: null,
      call_log_ref: null,
      updated_at: null,
    }
    expect(pipelineItemIsComplete(manualRow)).toBe(true)
    expect(pipelineItemIsComplete(undefined)).toBe(false)
  })

  it("builds detail lines for screening and compliance items", () => {
    expect(buildPipelineDetailLine("call_1", undefined, false)).toBe("No call logs synced yet")
    expect(
      buildPipelineDetailLine("oig", { ...baseRow("oig"), manual_completed: true }, true)
    ).toBe("Completed manually")
  })

  it("uses checkbox labels for compliance items", () => {
    expect(pipelineCheckboxLabel("oig")).toBe("For Verification")
    expect(pipelineCheckboxLabel("w2_i9")).toBe("To be signed")
  })

  it("marks sections complete only when all items are done", () => {
    const rows = new Map([
      ["oig", { ...baseRow("oig"), manual_completed: true }],
      ["drug", baseRow("drug")],
      ["bg", baseRow("bg")],
    ] as const)
    expect(pipelineSectionComplete("compliance", rows)).toBe(false)

    rows.set("drug", { ...baseRow("drug"), manual_completed: true })
    rows.set("bg", { ...baseRow("bg"), manual_completed: true })
    expect(pipelineSectionComplete("compliance", rows)).toBe(true)
  })
})

function baseRow(itemKey: string): PipelineChecklistItemRow {
  return {
    item_key: itemKey,
    manual_completed: false,
    manual_completed_by: null,
    manual_completed_at: null,
    call_log_completed: false,
    call_log_completed_at: null,
    call_log_ref: null,
    updated_at: null,
  }
}
