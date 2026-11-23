export const LAUNCH_PAD_STEPS = [
  {
    id: "logo",
    number: 1,
    title: "Add Company logo",
    pageTitle: "Company Logo",
    description: "Logo, tagline, favicon. Shows on the applicant page.",
    progressLabel: "Company Logo",
  },
  {
    id: "branding",
    number: 2,
    title: "Customize your Branding",
    pageTitle: "Customize your Branding",
    description: "Colors, font, welcome headline.",
    progressLabel: "Branding",
  },
  {
    id: "domain",
    number: 3,
    title: "Setup Domain",
    pageTitle: "Setup Custom Domain",
    description: "yourname.brasshr.com for the applicant portal.",
    progressLabel: "Domain",
  },
  {
    id: "preview",
    number: 4,
    title: "Applicant Preview",
    pageTitle: "Applicant Preview",
    description: "See how your apply page looks.",
    progressLabel: "Preview",
  },
  {
    id: "invite",
    number: 5,
    title: "Invite Team",
    pageTitle: "Invite Team",
    description: "Add an HR or manager. You can do this later.",
    progressLabel: "Invite Team",
  },
  {
    id: "organization",
    number: 6,
    title: "Organization Details",
    pageTitle: "Organization Details",
    description: "Full address, EIN, employee count. Optional.",
    progressLabel: "Organization",
  },
] as const;

export type LaunchPadStepId = (typeof LAUNCH_PAD_STEPS)[number]["id"];

export const LAUNCH_PAD_STEP_IDS = LAUNCH_PAD_STEPS.map((step) => step.id);

export function isLaunchPadStepId(value: string | null | undefined): value is LaunchPadStepId {
  return Boolean(value && LAUNCH_PAD_STEP_IDS.includes(value as LaunchPadStepId));
}

export const LAUNCH_PAD_STORAGE_KEY = "braasLaunchPadCompletedSteps";

export { brandUiFontStyle as interStyle } from "@/lib/tenant/branding-typography-styles";
