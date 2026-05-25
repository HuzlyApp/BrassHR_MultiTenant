import type { StepColorKey } from "./types";

export const GOLD = "#BC8B41";
export const NAVY = "#012352";
export const PAGE_BG = "#f8f8f8";
export const CARD_BORDER = "#eaecf0";
export const TEXT_PRIMARY = "#101828";
export const TEXT_SECONDARY = "#667085";
export const TEXT_MUTED = "#98a2b3";
export const GOLD_GRADIENT = "linear-gradient(90deg, #BC8B41 0%, #E9B771 100%)";

export const STEP_COLORS: Record<
  StepColorKey,
  { header: string; body: string; text: string; ring: string }
> = {
  navy: {
    header: "#012352",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#012352",
  },
  purple: {
    header: "#7C3AED",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#7C3AED",
  },
  green: {
    header: "#16A34A",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#16A34A",
  },
  pink: {
    header: "#EC4899",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#EC4899",
  },
  amber: {
    header: "#F59E0B",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#F59E0B",
  },
  teal: {
    header: "#0D9488",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#0D9488",
  },
  rose: {
    header: "#E11D48",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#E11D48",
  },
  indigo: {
    header: "#4F46E5",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#4F46E5",
  },
  slate: {
    header: "#475569",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#475569",
  },
  customStepColor: {
    header: "#4F69C6",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#4F69C6",
  },
  resumeProfileColor: {
    header: "#0000FF",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#0000FF",
  },
  jobApplicationColor: {
    header: "#660099",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#660099",
  },
  skillQualificationAssessmentColor: {
    header: "#50C878",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#50C878",
  },
  customApplicationFormColor: {
    header: "#FFBF00",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FFBF00",
  },
  welcomePackageColor: {
    header: "#FF007F",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FF007F",
  },
  rightToWorkColor: {
    header: "#00FF00",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#00FF00",
  },
  employeeAgreementColor: {
    header: "#008080",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#008080",
  },
  policyAcknowledgmentColor: {
    header: "#708090",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#708090",
  },
  badgeAcknowledgmentColor: {
    header: "#0066FF",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#0066FF",
  },
  benifitsEnrollmentColor: {
    header: "#FFC0CB",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FFC0CB",
  },
  safetyTrainingColor: {
    header: "#FF681F",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FF681F",
  },
  trainingModule: {
    header: "#008000",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#008000",
  },
};

export const DRAG_DATA_TYPE = "application/x-workflow-step";
