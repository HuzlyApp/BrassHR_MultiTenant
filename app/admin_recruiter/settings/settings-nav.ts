import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileStack,
  Library,
  ListChecks,
  Plug,
  Scale,
  Users,
  Wand2,
  Workflow,
} from "lucide-react";

export type SettingsNavItemId =
  | "company-profile"
  | "user-management"
  | "billing"
  | "branding"
  | "call"
  | "task"
  | "library"
  | "workflows"
  | "profession"
  | "assessment"
  | "statuses"
  | "templates"
  | "roles"
  | "departments"
  | "integrations"
  | "legal-documents"
  | "help"
  | "reports";

export type SettingsSectionSlug =
  | "company-profile"
  | "branding"
  | "call"
  | "task"
  | "user-management"
  | "billing"
  | "roles"
  | "departments"
  | "integrations"
  | "profession"
  | "assessment"
  | "statuses"
  | "templates"
  | "legal-documents"
  | "hiring-theme";

export type SettingsNavItem = {
  id: SettingsNavItemId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission resource required to show this item (see permission-catalog). */
  resourceKey: string;
  /** Highlight when pathname matches any of these prefixes. */
  matchPrefixes: string[];
  matchExact?: boolean;
};

export type SettingsNavGroup = {
  id: string;
  label: string | null;
  items: SettingsNavItem[];
};

/** Secondary Settings sidebar — only items that already exist in the app.
 * Personal Settings (Profile, Account & Settings) live in the
 * top-right user dropdown only — not in this mini-sidebar.
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "app",
    label: "Company Settings",
    items: [
      {
        id: "company-profile",
        label: "Company Profile",
        href: "/admin_recruiter/settings/company-profile",
        icon: Building2,
        resourceKey: "settings_company",
        matchPrefixes: [
          "/admin_recruiter/settings/company-profile",
          "/admin_recruiter/account/business-info",
        ],
      },
      {
        id: "user-management",
        label: "User Management",
        href: "/admin_recruiter/settings/user-management",
        icon: Users,
        resourceKey: "settings_company",
        matchPrefixes: [
          "/admin_recruiter/settings/user-management",
          "/admin_recruiter/settings/admin-console",
          "/admin_recruiter/settings/roles",
          "/admin_recruiter/settings/roles/new",
          "/admin_recruiter/settings/roles/success",
        ],
      },
      {
        id: "departments",
        label: "Departments",
        href: "/admin_recruiter/settings/departments",
        icon: Building2,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/departments"],
      },
      {
        id: "branding",
        label: "Branding",
        href: "/admin_recruiter/settings/branding",
        icon: Wand2,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/branding", "/admin_recruiter/settings/hiring-theme"],
      },
      {
        id: "integrations",
        label: "Integrations",
        href: "/admin_recruiter/settings/integrations",
        icon: Plug,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/integrations"],
      },
      {
        id: "legal-documents",
        label: "Legal Documents",
        href: "/admin_recruiter/settings/legal-documents",
        icon: Scale,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/legal-documents"],
      },
      // Call lives in the top-right account menu (Personal Settings).
      // {
      //   id: "call",
      //   label: "Call",
      //   href: "/admin_recruiter/settings/call",
      //   icon: Phone,
      //   resourceKey: "settings_company",
      //   matchPrefixes: ["/admin_recruiter/settings/call"],
      // },
      // Task settings hidden from Settings mini-sidebar for now.
      // {
      //   id: "task",
      //   label: "Task",
      //   href: "/admin_recruiter/settings/task",
      //   icon: ClipboardCheck,
      //   resourceKey: "settings_company",
      //   matchPrefixes: ["/admin_recruiter/settings/task"],
      // },
      {
        id: "billing",
        label: "Billing & Subscription",
        href: "/admin_recruiter/settings/billing",
        icon: CreditCard,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/billing"],
      },
      // Help & Support → main sidebar (below Settings) + profile menu.
    ],
  },
  {
    id: "workflow",
    label: "Workflows",
    items: [
      {
        id: "workflows",
        label: "Workflows",
        href: "/admin_recruiter/dashboard/onboarding-flows",
        icon: Workflow,
        resourceKey: "settings_automation",
        matchPrefixes: [
          "/admin_recruiter/dashboard/onboarding-flows",
          "/admin_recruiter/dashboard/templates",
          "/admin_recruiter/dashboard/workflow-mappings",
          "/admin_recruiter/dashboard/onboarding-builder",
        ],
      },
      {
        id: "library",
        label: "Library",
        href: "/admin_recruiter/dashboard/workflowlibrary",
        icon: Library,
        resourceKey: "settings_automation",
        matchPrefixes: ["/admin_recruiter/dashboard/workflowlibrary"],
      },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    items: [
      {
        id: "profession",
        label: "Professions",
        href: "/admin_recruiter/settings/profession",
        icon: Briefcase,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/profession"],
      },
      {
        id: "assessment",
        label: "Assessment",
        href: "/admin_recruiter/settings/assessment",
        icon: ClipboardList,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/assessment"],
      },
      {
        id: "statuses",
        label: "Statuses",
        href: "/admin_recruiter/settings/statuses",
        icon: ListChecks,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/statuses"],
      },
      {
        id: "templates",
        label: "Templates",
        href: "/admin_recruiter/settings/templates",
        icon: FileStack,
        resourceKey: "settings_templates",
        matchPrefixes: [
          "/admin_recruiter/settings/templates",
          "/admin_recruiter/template-builder",
          "/admin_recruiter/email-templates",
        ],
      },
    ],
  },
  // Roles & Permissions → User Management tab.
  // Call → top-right account menu; Integrations → Company Settings (below Branding).
  // Reports → main sidebar (below Pay).
  // {
  //   id: "administration",
  //   label: "Administration",
  //   items: [...],
  // },
];

/** In-app settings sections rendered under /admin_recruiter/settings/[section]. */
export const SETTINGS_SECTION_META: Record<
  SettingsSectionSlug,
  { title: string; description: string }
> = {
  "company-profile": {
    title: "Company Profile",
    description: "Manage your company details, location, contact information, and e-signature settings.",
  },
  branding: {
    title: "Branding",
    description: "Customized your branding.",
  },
  call: {
    title: "Call",
    description: "Place or answer a Dialpad call, and review recent call logs.",
  },
  task: {
    title: "Task",
    description: "Control who can assign tasks on the worker Taskboard.",
  },
  "user-management": {
    title: "User Management",
    description: "Manage users, invitations, roles, and administrative access for your organization.",
  },
  billing: {
    title: "Billing & Subscription",
    description: "View trial status, billing details, and subscription information.",
  },
  roles: {
    title: "User Management",
    description: "Manage users, invitations, roles, and administrative access for your organization.",
  },
  departments: {
    title: "Departments",
    description: "Manage your departments",
  },
  integrations: {
    title: "Integrations",
    description: "Manage inbound API keys for MSP and resume source integrations.",
  },
  profession: {
    title: "Professions",
    description: "Organize job industry and manage their positions.",
  },
  assessment: {
    title: "Assessment",
    description: "Evaluate candidates' skills with profession-linked assessments.",
  },
  statuses: {
    title: "Statuses",
    description: "Manage statuses used in your recruitment pipeline. Customize labels, colors, and workflows.",
  },
  templates: {
    title: "Templates",
    description: "Document, email, and onboarding templates.",
  },
  "legal-documents": {
    title: "Legal Documents",
    description:
      "View, update, and add privacy policies, terms, and other legal documents shown to applicants, workers, and tenant users.",
  },
  "hiring-theme": {
    title: "Hiring journey",
    description: "Customize colors used across the hiring journey experience.",
  },
};

export const SETTINGS_SECTION_SLUGS = Object.keys(SETTINGS_SECTION_META) as SettingsSectionSlug[];

export function isSettingsSectionSlug(value: string): value is SettingsSectionSlug {
  return SETTINGS_SECTION_SLUGS.includes(value as SettingsSectionSlug);
}

export function settingsSectionHref(slug: SettingsSectionSlug): string {
  return `/admin_recruiter/settings/${slug}`;
}

export function isSettingsNavItemActive(item: SettingsNavItem, pathname: string): boolean {
  if (item.matchExact) {
    return item.matchPrefixes.some((prefix) => pathname === prefix);
  }
  return item.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Hide Settings mini-sidebar rows the signed-in role cannot view. */
export function visibleSettingsNavGroups(
  groups: SettingsNavGroup[],
  viewKeys: ReadonlySet<string> | null,
  unrestricted = false
): SettingsNavGroup[] {
  if (unrestricted || viewKeys?.has("*") || viewKeys === null) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => viewKeys.has(item.resourceKey)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Default landing page when opening Settings from the main sidebar (admins). */
export const SETTINGS_LANDING_HREF = "/admin_recruiter/settings/branding";

const SETTINGS_LANDING_FALLBACK_HREF = "/admin_recruiter/help-support";

/**
 * First Settings mini-sidebar page the signed-in role can open.
 * Recruiters lack `settings_company`, so branding (/settings/*) returns "No access".
 */
export function resolveSettingsLandingHref(
  viewKeys: ReadonlySet<string> | null,
  unrestricted = false
): string {
  if (unrestricted || viewKeys?.has("*") || viewKeys === null) {
    return SETTINGS_LANDING_HREF;
  }
  const groups = visibleSettingsNavGroups(SETTINGS_NAV_GROUPS, viewKeys, false);
  for (const group of groups) {
    for (const item of group.items) {
      const href = item.href?.trim();
      if (href) return href;
    }
  }
  return SETTINGS_LANDING_FALLBACK_HREF;
}

/** All path prefixes covered by the settings mini-sidebar.
 * Personal account pages and Notifications are opened from the user dropdown
 * and intentionally do not keep the Settings mini-sidebar open.
 */
export const SETTINGS_MINI_SIDEBAR_PREFIXES: string[] = Array.from(
  new Set(
    SETTINGS_NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => item.matchPrefixes)).concat([
      "/admin_recruiter/settings",
      "/admin_recruiter/account/business-info",
      "/admin_recruiter/dashboard/onboarding-flows",
      "/admin_recruiter/dashboard/workflow-mappings",
      "/admin_recruiter/dashboard/workflowlibrary",
      "/admin_recruiter/dashboard/workflow-builder",
      "/admin_recruiter/dashboard/workflows",
      "/admin_recruiter/dashboard/templates",
      "/admin_recruiter/dashboard/onboarding-builder",
      "/admin_recruiter/template-builder",
      "/admin_recruiter/email-templates",
    ])
  )
);

/** True while the settings mini-sidebar should stay open for this route. */
export function isSettingsMiniSidebarPath(pathname: string): boolean {
  const path = pathname.trim();
  if (!path) return false;
  return SETTINGS_MINI_SIDEBAR_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

