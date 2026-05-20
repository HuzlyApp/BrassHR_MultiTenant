export const INDUSTRY_OPTIONS = [
  "Healthcare",
  "Staffing & Recruiting",
  "Home Care",
  "Allied Health",
  "Technology",
  "Other",
] as const;

export const COMPANY_SIZE_OPTIONS = [
  "1–10 employees",
  "11–50 employees",
  "51–200 employees",
  "201–500 employees",
  "500+ employees",
] as const;

export const STATE_OPTIONS = [
  "California",
  "Arizona",
  "Texas",
  "New York",
  "Florida",
  "Illinois",
  "Other",
] as const;

/** UI-only business fields (not sent to API yet). */
export type BusinessInfoForm = {
  industry: string;
  companySize: string;
  phone: string;
  website: string;
  city: string;
  state: string;
  zipCode: string;
  address: string;
};

export const initialBusinessInfoForm = (): BusinessInfoForm => ({
  industry: "",
  companySize: "",
  phone: "",
  website: "",
  city: "",
  state: "",
  zipCode: "",
  address: "",
});

export const TENANT_GOAL_OPTIONS = [
  {
    id: "hr_data_reporting",
    label: "HR Data & Reporting",
    icon: "/icons/braas-HR/tenant-onboarding/hr-data.svg",
  },
  {
    id: "time_attendance",
    label: "Time & Attendance",
    icon: "/icons/braas-HR/tenant-onboarding/time-attandence.svg",
  },
  {
    id: "hiring_onboarding",
    label: "Hiring & Onboarding",
    icon: "/icons/braas-HR/tenant-onboarding/hiring-onboarding.svg",
  },
  {
    id: "performance_management",
    label: "Performance Management",
    icon: "/icons/braas-HR/tenant-onboarding/perfomance-management.svg",
  },
  {
    id: "compensation_planning",
    label: "Compensation Planning",
    icon: "/icons/braas-HR/tenant-onboarding/compansation-planning.svg",
  },
  {
    id: "ai_powered_hr",
    label: "AI Powered HR",
    icon: "/icons/braas-HR/tenant-onboarding/ai-powered-hr.svg",
  },
] as const;

export type TenantGoalId = (typeof TENANT_GOAL_OPTIONS)[number]["id"];

export const BRAND_COLOR_PRESETS = [
  { primary: "#BC8B41", secondary: "#104b83", accent: "#E9B771", label: "Brass default" },
  { primary: "#0d9488", secondary: "#0f766e", accent: "#99f6e4", label: "Teal" },
  { primary: "#2563eb", secondary: "#1e40af", accent: "#93c5fd", label: "Blue" },
  { primary: "#7c3aed", secondary: "#5b21b6", accent: "#c4b5fd", label: "Purple" },
] as const;

/** Figma branding step — matches platform/API colors when "system". */
export type TenantBrandingThemeMode = "system" | "custom";

export type TenantBrandingFontId = "inter" | "impact" | "roboto" | "poppins" | "ubuntu";

export const TENANT_BRANDING_FONT_OPTIONS = [
  {
    id: "inter" as const,
    label: "Inter",
    /** Set by `app/tenant-onboarding/layout.tsx` */
    fontFamily:
      "var(--font-tenant-branding-inter, ui-sans-serif), Inter, system-ui, sans-serif",
    isSystemDefault: true,
  },
  {
    id: "impact" as const,
    label: "Impact",
    fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  },
  {
    id: "roboto" as const,
    label: "Roboto",
    fontFamily:
      "var(--font-tenant-branding-roboto, sans-serif), Roboto, system-ui, sans-serif",
  },
  {
    id: "poppins" as const,
    label: "Poppins",
    fontFamily:
      "var(--font-tenant-branding-poppins, sans-serif), Poppins, system-ui, sans-serif",
  },
  {
    id: "ubuntu" as const,
    label: "Ubuntu",
    fontFamily:
      "var(--font-tenant-branding-ubuntu, sans-serif), Ubuntu, system-ui, sans-serif",
  },
] as const satisfies ReadonlyArray<{
  id: TenantBrandingFontId;
  label: string;
  fontFamily: string;
  isSystemDefault?: boolean;
}>;

export function brandingFontStack(id: TenantBrandingFontId): string {
  const row = TENANT_BRANDING_FONT_OPTIONS.find((o) => o.id === id);
  return row?.fontFamily ?? TENANT_BRANDING_FONT_OPTIONS[0].fontFamily;
}
