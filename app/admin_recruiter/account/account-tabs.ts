export const ACCOUNT_TABS = [
  { slug: "personal", label: "Profile" },
  { slug: "account-security", label: "Account & Security" },
  // Legacy slugs kept for redirects / deep links.
  { slug: "account-settings", label: "Account" },
  { slug: "security", label: "Security" },
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
  if (slug === "account-settings" || slug === "security") {
    return "/admin_recruiter/account/account-security";
  }
  return `/admin_recruiter/account/${slug}`;
}

/** Tabs shown in the account page tab bar. */
export const ACCOUNT_TAB_NAV = [
  { slug: "personal" as const, label: "Profile" },
  { slug: "account-security" as const, label: "Account & Security" },
];
