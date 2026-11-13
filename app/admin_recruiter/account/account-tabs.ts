export const ACCOUNT_TABS = [
  { slug: "personal", label: "Profile" },
  { slug: "account-settings", label: "Account" },
  { slug: "security", label: "Security" },
  // Business Info moved to Settings → Company Profile.
  // { slug: "checklist", label: "Checklist" }, // Hidden for now; keep for future enablement
] as const;

export type AccountTabSlug = (typeof ACCOUNT_TABS)[number]["slug"];

/** Company admin tabs. Hidden from recruiter / manager / limited staff roles. */
const RECRUITER_HIDDEN_ACCOUNT_TAB_SLUGS = new Set<AccountTabSlug>();

export function isRecruiterHiddenAccountTab(slug: AccountTabSlug): boolean {
  return RECRUITER_HIDDEN_ACCOUNT_TAB_SLUGS.has(slug);
}

export function isAccountTabSlug(value: string): value is AccountTabSlug {
  return ACCOUNT_TABS.some((tab) => tab.slug === value);
}

export function accountTabHref(slug: AccountTabSlug): string {
  return `/admin_recruiter/account/${slug}`;
}
