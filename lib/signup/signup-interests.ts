/** Stable reporting keys for why an owner signed up, independent of UI wording. */
export const SIGNUP_INTERESTS = [
  { key: "hr_data_reporting", label: "HR Data & Reporting" },
  { key: "time_attendance", label: "Time & Attendance" },
  { key: "hiring_onboarding", label: "Hiring & Onboarding" },
  { key: "performance_management", label: "Performance Management" },
  { key: "compensation_planning", label: "Compensation Planning" },
  { key: "ai_powered_hr", label: "AI Powered HR" },
] as const;

export type SignupInterestKey = (typeof SIGNUP_INTERESTS)[number]["key"];
export const SIGNUP_INTEREST_KEYS = SIGNUP_INTERESTS.map((interest) => interest.key) as [SignupInterestKey, ...SignupInterestKey[]];

export type SignupInterests = {
  keys: SignupInterestKey[];
  skipped: boolean;
  answeredAt: string | null;
};
