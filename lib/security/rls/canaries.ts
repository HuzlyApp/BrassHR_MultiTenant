/** Unique leakage canaries. A Tenant A response must never contain Tenant B/A2 secrets. */
export const CANARIES = {
  tenantA: "CANARY_TENANT_A_8f2e",
  tenantB: "CANARY_TENANT_B_6d91",
  tenantC: "CANARY_TENANT_C_4c11",
  applicationA1: "CANARY_APPLICATION_A1_d873",
  applicationA2: "CANARY_APPLICATION_A2_12af",
  applicationB1: "CANARY_APPLICATION_B1_9c44",
  applicationB2: "CANARY_APPLICATION_B2_7e21",
  noteA1: "SECRET_A1_NOTE_CANARY_d873",
  noteA2: "SECRET_A2_NOTE_CANARY_12af",
  noteB1: "SECRET_B1_NOTE_CANARY_9c44",
  screeningA1: "SECRET_A1_SCREENING_CANARY_d873",
  screeningA2: "SECRET_A2_SCREENING_CANARY_12af",
  screeningB1: "SECRET_B1_SCREENING_CANARY_9c44",
  interviewA1: "SECRET_A1_MEETING_https://meet.example/a1-d873",
  interviewB1: "SECRET_B1_MEETING_https://meet.example/b1-9c44",
  analysisA1: "SECRET_A1_ANALYSIS_CANARY_d873",
  analysisA2: "SECRET_A2_ANALYSIS_CANARY_12af",
  analysisB1: "SECRET_B1_ANALYSIS_CANARY_9c44",
  decisionA1: "SECRET_A1_DECISION_NOTE_d873",
  decisionB1: "SECRET_B1_DECISION_NOTE_9c44",
} as const;

export const FOREIGN_TENANT_CANARIES = [
  CANARIES.tenantB,
  CANARIES.tenantC,
  CANARIES.applicationB1,
  CANARIES.applicationB2,
  CANARIES.noteB1,
  CANARIES.screeningB1,
  CANARIES.interviewB1,
  CANARIES.analysisB1,
  CANARIES.decisionB1,
] as const;

export const CROSS_APPLICATION_CANARIES_FROM_A1 = [
  CANARIES.applicationA2,
  CANARIES.noteA2,
  CANARIES.screeningA2,
  CANARIES.analysisA2,
] as const;

export function payloadContainsCanary(
  payload: unknown,
  canaries: readonly string[]
): string | null {
  const text = stringifyForCanaryScan(payload);
  return canaries.find((canary) => text.includes(canary)) ?? null;
}

export function stringifyForCanaryScan(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}
