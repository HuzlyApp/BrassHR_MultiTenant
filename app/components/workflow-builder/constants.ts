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
  denimBlue: {
    header: "#4F69C6",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#4F69C6",
  },
  pureBlue: {
    header: "#0000FF",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#0000FF",
  },
  royalPurple: {
    header: "#660099",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#660099",
  },
  emeraldGreen: {
    header: "#50C878",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#50C878",
  },
  amberGold: {
    header: "#FFBF00",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FFBF00",
  },
  brightRose: {
    header: "#FF007F",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FF007F",
  },
  limeGreen: {
    header: "#00FF00",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#00FF00",
  },
  tealNew: {
    header: "#008080",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#008080",
  },
  slateGray: {
    header: "#708090",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#708090",
  },
  electricBlue: {
    header: "#0066FF",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#0066FF",
  },
  pastelPink: {
    header: "#FFC0CB",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FFC0CB",
  },
  safetyOrange: {
    header: "#FF681F",
    body: "#ffffff",
    text: "#ffffff",
    ring: "#FF681F",
  },
  neonCyan: {
    header: "#00FFFF",
    body: "#ffffff",
    text: "#333333",
    ring: "#00FFFF",
  },
};

export const DRAG_DATA_TYPE = "application/x-workflow-step";
