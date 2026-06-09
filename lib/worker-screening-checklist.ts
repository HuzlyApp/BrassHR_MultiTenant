import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildPipelineDetailLine,
  getPipelineItemDef,
  isPipelineChecklistItemKey,
  loadWorkerPipelineChecklistItems,
  pipelineItemIsComplete,
  PIPELINE_CHECKLIST_ITEM_KEYS,
  type PipelineChecklistItemKey,
  type PipelineChecklistItemRow,
} from "./worker-pipeline-checklist"

/** @deprecated Use worker-pipeline-checklist types instead */
export const SCREENING_CHECKLIST_ITEM_KEYS = ["call_1", "call_2"] as const
/** @deprecated Use PipelineChecklistItemKey instead */
export type ScreeningChecklistItemKey = "call_1" | "call_2"
/** @deprecated Use PipelineChecklistItemRow instead */
export type ScreeningChecklistItemRow = PipelineChecklistItemRow

export function isScreeningChecklistItemKey(value: unknown): value is ScreeningChecklistItemKey {
  return value === "call_1" || value === "call_2"
}

export function screeningItemIsComplete(row: PipelineChecklistItemRow | undefined): boolean {
  return pipelineItemIsComplete(row)
}

export function buildScreeningDetailLine(
  row: PipelineChecklistItemRow | undefined,
  isComplete: boolean
): string {
  return buildPipelineDetailLine("call_1", row, isComplete) ?? "No call logs synced yet"
}

export async function loadWorkerScreeningChecklistItems(
  supabase: SupabaseClient,
  workerId: string
): Promise<Map<ScreeningChecklistItemKey, ScreeningChecklistItemRow>> {
  const all = await loadWorkerPipelineChecklistItems(supabase, workerId)
  const map = new Map<ScreeningChecklistItemKey, ScreeningChecklistItemRow>()
  for (const key of ["call_1", "call_2"] as const) {
    const row = all.get(key)
    if (row) map.set(key, row)
  }
  return map
}

export function buildScreeningChecklistItemStates(
  rowsByKey: Map<ScreeningChecklistItemKey, ScreeningChecklistItemRow>
) {
  return (["call_1", "call_2"] as const).map((itemKey) => {
    const row = rowsByKey.get(itemKey)
    const isComplete = pipelineItemIsComplete(row)
    return {
      itemKey,
      isComplete,
      manualCompleted: row?.manual_completed === true,
      callLogCompleted: row?.call_log_completed === true,
      manualCompletedAt: row?.manual_completed_at ?? null,
      callLogCompletedAt: row?.call_log_completed_at ?? null,
      detailLine: buildPipelineDetailLine(itemKey, row, isComplete) ?? "No call logs synced yet",
    }
  })
}

export function screeningChecklistSectionComplete(
  states: Array<{ isComplete: boolean }>
): boolean {
  return states.length > 0 && states.every((s) => s.isComplete)
}

export function getScreeningItemLabels(itemKey: ScreeningChecklistItemKey) {
  const def = getPipelineItemDef(itemKey)
  return { title: def.title, subtitle: def.subtitle ?? "" }
}

export { PIPELINE_CHECKLIST_ITEM_KEYS, isPipelineChecklistItemKey }
