export const INDUSTRY_OPTIONS = [
  "Staffing & Recruiting",
  "Healthcare",
  "Home Care / Home Health",
  "Allied Health",
  "Senior Care / Assisted Living",
  "Hospitality / Food Service",
  "Retail & Convenience Stores",
  "Technology / IT Services",
  "Construction & Trades",
  "Cleaning & Janitorial Services",
  "Education / Childcare / Daycare",
  "Nonprofit / Community Organizations",
  "Manufacturing / Warehouse / Distribution",
  "Transportation & Logistics",
  "Professional Services",
  "Beauty / Salon / Spa",
  "Fitness / Wellness / Gyms",
  "Other",
] as const;

export const COMPANY_SIZE_OPTIONS = [
  "1-10",
  "10-30",
  "30-50",
  "50-100",
  "100+",
] as const;

export const CITY_OPTIONS = [
  "Los Angeles",
  "San Francisco",
  "San Diego",
  "Phoenix",
  "Houston",
  "Chicago",
  "New York",
  "Miami",
  "Other",
] as const;

export const STATE_OPTIONS = [
  "Alabama",
  "Alaska",
  "Arizona",
  "California",
  "Colorado",
  "Florida",
  "Georgia",
  "Illinois",
  "New York",
  "Texas",
  "Washington",
  "Other",
] as const;

/** Business fields collected during tenant onboarding. */
export type BusinessInfoForm = {
  industry: string;
  companySize: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  zipCode: string;
  ein: string;
};

export const initialBusinessInfoForm = (): BusinessInfoForm => ({
  industry: "",
  companySize: "",
  city: "",
  state: "",
  address: "",
  phone: "",
  email: "",
  zipCode: "",
  ein: "",
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
