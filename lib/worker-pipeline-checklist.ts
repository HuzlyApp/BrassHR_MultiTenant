import type { SupabaseClient } from "@supabase/supabase-js"

export const PIPELINE_CHECKLIST_ITEM_KEYS = [
  "call_1",
  "call_2",
  "oig",
  "drug",
  "bg",
  "fac_approval",
  "sworn",
  "w2_i9",
  "everify",
  "wheniwork",
  "paychex",
  "welcome_email",
  "badge",
] as const

export type PipelineChecklistItemKey = (typeof PIPELINE_CHECKLIST_ITEM_KEYS)[number]

export type PipelineChecklistSectionId =
  | "screening"
  | "compliance"
  | "facility_req"
  | "new_hire"
  | "final"

export type PipelineChecklistItemRow = {
  item_key: string
  manual_completed: boolean
  manual_completed_by: string | null
  manual_completed_at: string | null
  call_log_completed: boolean
  call_log_completed_at: string | null
  call_log_ref: string | null
  updated_at: string | null
}

export type PipelineChecklistItemDef = {
  title: string
  subtitle?: string
  optional?: boolean
  checkboxLabel?: string
}

export const PIPELINE_CHECKLIST_SECTIONS: Array<{
  id: PipelineChecklistSectionId
  itemKeys: PipelineChecklistItemKey[]
}> = [
  { id: "screening", itemKeys: ["call_1", "call_2"] },
  { id: "compliance", itemKeys: ["oig", "drug", "bg"] },
  { id: "facility_req", itemKeys: ["fac_approval", "sworn"] },
  { id: "new_hire", itemKeys: ["w2_i9", "everify", "wheniwork", "paychex"] },
  { id: "final", itemKeys: ["welcome_email", "badge"] },
]

const ITEM_DEFS: Record<PipelineChecklistItemKey, PipelineChecklistItemDef> = {
  call_1: { title: "Call 1", subtitle: "For Interview" },
  call_2: { title: "Call 2", subtitle: "Done Initial Interview" },
  oig: { title: "OIG Verification", subtitle: "(Not Mandatory)", optional: true, checkboxLabel: "For Verification" },
  drug: { title: "Drug Test", subtitle: "(Not Mandatory)", optional: true, checkboxLabel: "For Drug Test" },
  bg: { title: "Background Check", checkboxLabel: "For Background Check" },
  fac_approval: { title: "Facility Approval", subtitle: "For eSign" },
  sworn: { title: "Sworn Statement", subtitle: "To be fill-up" },
  w2_i9: { title: "Employee Agreement W2 + I9", subtitle: "To be signed" },
  everify: { title: "Create eVerify Record", subtitle: "To be created" },
  wheniwork: { title: "WhenIWork Account", subtitle: "To be created" },
  paychex: { title: "PayChex Account", subtitle: "To be created" },
  welcome_email: { title: "Welcome Email Sent", subtitle: "For Email" },
  badge: { title: "Badge Sent", subtitle: "Send badge" },
}

const TABLE_NAMES = ["worker_pipeline_checklist_items", "worker_screening_checklist_items"] as const

export function isPipelineChecklistItemKey(value: unknown): value is PipelineChecklistItemKey {
  return typeof value === "string" && (PIPELINE_CHECKLIST_ITEM_KEYS as readonly string[]).includes(value)
}

export function getPipelineItemDef(itemKey: PipelineChecklistItemKey): PipelineChecklistItemDef {
  return ITEM_DEFS[itemKey]
}

export function getPipelineSectionForItem(itemKey: PipelineChecklistItemKey): PipelineChecklistSectionId {
  const section = PIPELINE_CHECKLIST_SECTIONS.find((s) => s.itemKeys.includes(itemKey))
  return section?.id ?? "screening"
}

export function pipelineItemIsComplete(row: PipelineChecklistItemRow | undefined): boolean {
  if (!row) return false
  return row.manual_completed === true || row.call_log_completed === true
}

export function buildPipelineDetailLine(
  itemKey: PipelineChecklistItemKey,
  row: PipelineChecklistItemRow | undefined,
  isComplete: boolean
): string | undefined {
  if (itemKey === "call_1" || itemKey === "call_2") {
    if (isComplete) {
      if (row?.manual_completed && row?.call_log_completed) return "Completed manually and via call log"
      if (row?.call_log_completed) return "Completed via call log sync"
      if (row?.manual_completed) return "Completed manually"
      return "Completed"
    }
    if (row?.call_log_ref?.trim()) return "Call log synced — pending completion criteria"
    return "No call logs synced yet"
  }

  if (isComplete) {
    if (row?.call_log_completed && row?.manual_completed) return "Completed manually and via sync"
    if (row?.call_log_completed) return "Completed via sync"
    if (row?.manual_completed) return "Completed manually"
    return "Completed"
  }

  return undefined
}

function isMissingTableError(error: { message?: string }, tablePattern: RegExp): boolean {
  return (
    tablePattern.test(error.message ?? "") &&
    /not find|does not exist|schema cache/i.test(error.message ?? "")
  )
}

function shouldPreferPipelineRow(
  current: PipelineChecklistItemRow,
  candidate: PipelineChecklistItemRow
): boolean {
  const currentComplete = pipelineItemIsComplete(current)
  const candidateComplete = pipelineItemIsComplete(candidate)
  if (candidateComplete && !currentComplete) return true
  if (candidateComplete !== currentComplete) return false

  const currentUpdated = current.updated_at ?? ""
  const candidateUpdated = candidate.updated_at ?? ""
  return candidateUpdated > currentUpdated
}

export async function loadWorkerPipelineChecklistItems(
  supabase: SupabaseClient,
  workerId: string
): Promise<Map<PipelineChecklistItemKey, PipelineChecklistItemRow>> {
  const merged = new Map<PipelineChecklistItemKey, PipelineChecklistItemRow>()
  let loadedAnyTable = false

  for (const table of TABLE_NAMES) {
    const { data, error } = await supabase
      .from(table)
      .select(
        "item_key, manual_completed, manual_completed_by, manual_completed_at, call_log_completed, call_log_completed_at, call_log_ref, updated_at"
      )
      .eq("worker_id", workerId)
      .in("item_key", [...PIPELINE_CHECKLIST_ITEM_KEYS])

    if (error) {
      if (isMissingTableError(error, /worker_pipeline_checklist_items|worker_screening_checklist_items/i)) {
        continue
      }
      throw error
    }

    loadedAnyTable = true
    for (const raw of data ?? []) {
      const row = raw as PipelineChecklistItemRow
      if (!isPipelineChecklistItemKey(row.item_key)) continue

      const existing = merged.get(row.item_key)
      if (!existing || shouldPreferPipelineRow(existing, row)) {
        merged.set(row.item_key, row)
      }
    }
  }

  return loadedAnyTable ? merged : new Map()
}

export function pipelineSectionComplete(
  sectionId: PipelineChecklistSectionId,
  rowsByKey: Map<PipelineChecklistItemKey, PipelineChecklistItemRow>
): boolean {
  const section = PIPELINE_CHECKLIST_SECTIONS.find((s) => s.id === sectionId)
  if (!section) return false
  return section.itemKeys.every((key) => pipelineItemIsComplete(rowsByKey.get(key)))
}

export function pipelineCheckboxLabel(itemKey: PipelineChecklistItemKey): string {
  const def = ITEM_DEFS[itemKey]
  if (def.checkboxLabel) return def.checkboxLabel
  if (def.subtitle && !def.subtitle.startsWith("(")) return def.subtitle
  return `For ${def.title}`
}
