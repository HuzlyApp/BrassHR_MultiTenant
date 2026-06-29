/** Structured timing logs for resume upload / parse instrumentation. */

export type ResumeTimingPhase =
  | "upload-resume"
  | "process-resume"
  | "resume-parse-job"

export type ResumeTimingFields = Record<string, string | number | boolean | null | undefined>

export function logResumeTiming(
  phase: ResumeTimingPhase,
  event: string,
  fields: ResumeTimingFields = {},
): void {
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  )
  console.info(`[resume-timing] ${phase} ${event}`, payload)
}

export function createTimer(): { elapsedMs: () => number } {
  const start = performance.now()
  return {
    elapsedMs: () => Math.round(performance.now() - start),
  }
}
