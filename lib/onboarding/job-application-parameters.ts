/** Builder library id of the Parameterized Job Application node. */
export const PARAMETERIZED_JOB_APPLICATION_STEP_TYPE = "parameterized-job-application";

export function isParameterizedJobApplicationStepType(stepType: string | null | undefined): boolean {
  return (
    String(stepType ?? "").trim().toLowerCase().replaceAll("_", "-") ===
    PARAMETERIZED_JOB_APPLICATION_STEP_TYPE
  );
}

export type JobApplicationParameterField = {
  key: "requisition" | "profession" | "specialty" | "location" | "w2Classification" | "expectedStartDate";
  label: string;
  date?: boolean;
};

/** Job details the node covers: requisition, profession, specialty, location, W2 classification, start date. */
export const JOB_APPLICATION_PARAMETER_FIELDS: readonly JobApplicationParameterField[] = [
  { key: "requisition", label: "Requisition" },
  { key: "profession", label: "Profession" },
  { key: "specialty", label: "Specialty" },
  { key: "location", label: "Location" },
  { key: "w2Classification", label: "W2 classification" },
  { key: "expectedStartDate", label: "Expected start date", date: true },
];

export type JobApplicationParameterKey = JobApplicationParameterField["key"];
export type JobApplicationParameters = Record<JobApplicationParameterKey, string>;
