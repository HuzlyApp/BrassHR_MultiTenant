import { describe, expect, it } from "vitest"
import {
  buildScreeningChecklistItemStates,
  buildScreeningDetailLine,
  screeningChecklistSectionComplete,
  screeningItemIsComplete,
  type ScreeningChecklistItemRow,
} from "./worker-screening-checklist"

describe("worker-screening-checklist", () => {
  it("treats manual or call-log completion as complete", () => {
    expect(
      screeningItemIsComplete({
        item_key: "call_1",
        manual_completed: true,
        manual_completed_by: null,
        manual_completed_at: "2026-06-10T00:00:00.000Z",
        call_log_completed: false,
        call_log_completed_at: null,
        call_log_ref: null,
        updated_at: null,
      })
    ).toBe(true)

    expect(
      screeningItemIsComplete({
        item_key: "call_2",
        manual_completed: false,
        manual_completed_by: null,
        manual_completed_at: null,
        call_log_completed: true,
        call_log_completed_at: "2026-06-10T00:00:00.000Z",
        call_log_ref: "log-123",
        updated_at: null,
      })
    ).toBe(true)

    expect(screeningItemIsComplete(undefined)).toBe(false)
  })

  it("builds detail lines for pending and completed states", () => {
    const pendingRow: ScreeningChecklistItemRow = {
      item_key: "call_1",
      manual_completed: false,
      manual_completed_by: null,
      manual_completed_at: null,
      call_log_completed: false,
      call_log_completed_at: null,
      call_log_ref: null,
      updated_at: null,
    }
    expect(buildScreeningDetailLine(pendingRow, false)).toBe("No call logs synced yet")

    const manualRow: ScreeningChecklistItemRow = {
      ...pendingRow,
      manual_completed: true,
      manual_completed_at: "2026-06-10T00:00:00.000Z",
    }
    expect(buildScreeningDetailLine(manualRow, true)).toBe("Completed manually")
  })

  it("marks screening section complete only when both calls are done", () => {
    const states = buildScreeningChecklistItemStates(
      new Map([
        [
          "call_1",
          {
            item_key: "call_1",
            manual_completed: true,
            manual_completed_by: null,
            manual_completed_at: "2026-06-10T00:00:00.000Z",
            call_log_completed: false,
            call_log_completed_at: null,
            call_log_ref: null,
            updated_at: null,
          },
        ],
      ])
    )
    expect(screeningChecklistSectionComplete(states)).toBe(false)

    const completeStates = buildScreeningChecklistItemStates(
      new Map([
        [
          "call_1",
          {
            item_key: "call_1",
            manual_completed: true,
            manual_completed_by: null,
            manual_completed_at: "2026-06-10T00:00:00.000Z",
            call_log_completed: false,
            call_log_completed_at: null,
            call_log_ref: null,
            updated_at: null,
          },
        ],
        [
          "call_2",
          {
            item_key: "call_2",
            manual_completed: false,
            manual_completed_by: null,
            manual_completed_at: null,
            call_log_completed: true,
            call_log_completed_at: "2026-06-10T00:00:00.000Z",
            call_log_ref: "log-456",
            updated_at: null,
          },
        ],
      ])
    )
    expect(screeningChecklistSectionComplete(completeStates)).toBe(true)
  })
})
