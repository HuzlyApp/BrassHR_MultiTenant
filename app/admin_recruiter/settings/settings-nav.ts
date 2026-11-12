import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Library,
  LifeBuoy,
  ListChecks,
  Monitor,
  Phone,
  Plug,
  ShieldCheck,
  UserCircle,
  UserCog,
  Shield,
  Wand2,
  Workflow,
} from "lucide-react";

export type SettingsNavItemId =
  | "profile"
  | "account"
  | "branding"
  | "notifications"
  | "call"
  | "task"
  | "security"
  | "library"
  | "workflows"
  | "profession"
  | "assessment"
  | "statuses"
  | "templates"
  | "admin-console"
  | "roles"
  | "departments"
  | "integrations"
  | "help"
  | "reports";

export type SettingsSectionSlug =
  | "branding"
  | "call"
  | "task"
  | "admin-console"
  | "roles"
  | "departments"
  | "integrations"
  | "profession"
  | "assessment"
  | "statuses"
  | "security"
  | "templates"
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

/** Secondary Settings sidebar — only items that already exist in the app. */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "personal",
    label: "Personal Settings",
    items: [
      {
        id: "profile",
        label: "Profile",
        href: "/admin_recruiter/account/personal",
        icon: UserCircle,
        resourceKey: "settings_profile",
        // Only personal — do not use /admin_recruiter/account or Account routes also highlight.
        matchPrefixes: ["/admin_recruiter/account/personal"],
      },
      {
        id: "account",
        label: "Account",
        href: "/admin_recruiter/account/account-settings",
        icon: UserCog,
        resourceKey: "settings_profile",
        matchPrefixes: [
          "/admin_recruiter/account/account-settings",
          "/admin_recruiter/account/business-info",
        ],
      },
    ],
  },
  {
    id: "app",
    label: "App Settings",
    items: [
      {
        id: "branding",
        label: "Branding",
        href: "/admin_recruiter/settings/branding",
        icon: Wand2,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/branding", "/admin_recruiter/settings/hiring-theme"],
      },
      {
        id: "notifications",
        label: "Notifications",
        href: "/admin_recruiter/notifications",
        icon: Bell,
        resourceKey: "settings_notifications",
        matchPrefixes: ["/admin_recruiter/notifications"],
      },
      {
        id: "call",
        label: "Call",
        href: "/admin_recruiter/settings/call",
        icon: Phone,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/call"],
      },
      {
        id: "task",
        label: "Task",
        href: "/admin_recruiter/settings/task",
        icon: ClipboardCheck,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/task"],
      },
      {
        id: "help",
        label: "Help & Support",
        href: "/admin_recruiter/help-support",
        icon: LifeBuoy,
        // Visible to every staff role via settings mini-sidebar (not main rail).
        resourceKey: "settings_help",
        matchPrefixes: ["/admin_recruiter/help-support"],
      },
      {
        id: "security",
        label: "Security",
        // Password + authenticator live on account Security (settings/security redirects there).
        href: "/admin_recruiter/account/security",
        icon: ShieldCheck,
        resourceKey: "settings_company",
        matchPrefixes: [
          "/admin_recruiter/settings/security",
          "/admin_recruiter/account/security",
        ],
      },
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
        label: "Profession",
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
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "admin-console",
        label: "Admin Console",
        href: "/admin_recruiter/settings/admin-console",
        icon: Monitor,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/admin-console"],
      },
      {
        id: "roles",
        label: "Roles & Permissions",
        href: "/admin_recruiter/settings/roles",
        icon: Shield,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/roles"],
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
        id: "integrations",
        label: "Integrations",
        href: "/admin_recruiter/settings/integrations",
        icon: Plug,
        resourceKey: "settings_company",
        matchPrefixes: ["/admin_recruiter/settings/integrations"],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      {
        id: "reports",
        label: "Reports",
        href: "/admin_recruiter/reports",
        icon: BarChart3,
        resourceKey: "settings_reports",
        matchPrefixes: ["/admin_recruiter/reports", "/admin_recruiter/settings/reports"],
      },
    ],
  },
];

/** In-app settings sections rendered under /admin_recruiter/settings/[section]. */
export const SETTINGS_SECTION_META: Record<
  SettingsSectionSlug,
  { title: string; description: string }
> = {
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
  "admin-console": {
    title: "Admin Console",
    description: "Manage system-wide settings, users, and administrative controls.",
  },
  roles: {
    title: "Roles & Permissions",
    description: "Manage users, roles, and access permissions.",
  },
  departments: {
    title: "Departments",
    description: "Create departments and map them to jobs or candidates.",
  },
  integrations: {
    title: "Integrations",
    description: "Manage inbound API keys for MSP and resume source integrations.",
  },
  profession: {
    title: "Profession",
    description: "Configure profession document requirements for applicants.",
  },
  assessment: {
    title: "Assessment",
    description: "Build and manage skill assessments for your hiring flow.",
  },
  statuses: {
    title: "Statuses",
    description: "Manage statuses used in your recruitment pipeline. Customize labels, colors, and workflows.",
  },
  security: {
    title: "Security",
    description: "Authenticator app codes for staff sign-in.",
  },
  templates: {
    title: "Templates",
    description: "Document, email, and onboarding templates.",
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
      items: group.items.filter(
        (item) =>
          // Help & Support + Reports stay under Settings for every staff role.
          item.resourceKey === "settings_help" ||
          item.resourceKey === "settings_reports" ||
          viewKeys.has(item.resourceKey)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Default landing page when opening Settings from the main sidebar (admins). */
export const SETTINGS_LANDING_HREF = "/admin_recruiter/settings/branding";

const SETTINGS_LANDING_FALLBACK_HREF = "/admin_recruiter/account/personal";

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

/** All path prefixes covered by the settings mini-sidebar. */
export const SETTINGS_MINI_SIDEBAR_PREFIXES: string[] = Array.from(
  new Set(
    SETTINGS_NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => item.matchPrefixes)).concat([
      "/admin_recruiter/settings",
      "/admin_recruiter/account",
      "/admin_recruiter/notifications",
      "/admin_recruiter/dashboard/onboarding-flows",
      "/admin_recruiter/dashboard/workflow-mappings",
      "/admin_recruiter/dashboard/workflowlibrary",
      "/admin_recruiter/dashboard/workflow-builder",
      "/admin_recruiter/dashboard/workflows",
      "/admin_recruiter/dashboard/templates",
      "/admin_recruiter/dashboard/onboarding-builder",
      "/admin_recruiter/template-builder",
      "/admin_recruiter/email-templates",
      "/admin_recruiter/help-support",
      "/admin_recruiter/reports",
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

