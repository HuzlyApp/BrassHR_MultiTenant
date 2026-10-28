export type SettingsNavIcon = {
  src: string;
  width: number;
  height: number;
};

export type SettingsNavItem = {
  label: string;
  href: string;
  icon: SettingsNavIcon;
  resourceKey?: string;
  matchPrefixes: string[];
  matchExact?: boolean;
  /** In-settings page slug. Omitted when the item opens another app route. */
  section?: string;
};

export type SettingsNavGroup = {
  label: string;
  items: SettingsNavItem[];
};

const ICON = {
  branding: { src: "/icons/settings-nav/branding.svg", width: 20, height: 20 },
  roles: { src: "/icons/settings-nav/roles.svg", width: 20, height: 20 },
  departments: { src: "/icons/settings-nav/departments.svg", width: 12, height: 12 },
  professions: { src: "/icons/settings-nav/professions.svg", width: 11.8907, height: 12.5 },
  statuses: { src: "/icons/settings-nav/statuses.svg", width: 20, height: 20 },
  assessment: { src: "/icons/settings-nav/assessment.svg", width: 20, height: 20 },
  templates: { src: "/icons/settings-nav/templates.svg", width: 20, height: 20 },
  workflows: { src: "/icons/settings-nav/workflows.svg", width: 20, height: 20 },
  notifications: { src: "/icons/settings-nav/notifications.svg", width: 20, height: 20 },
  integrations: { src: "/icons/settings-nav/integrations.svg", width: 20, height: 20 },
  billing: { src: "/icons/settings-nav/billing.svg", width: 20, height: 20 },
  security: { src: "/icons/settings-nav/security.svg", width: 11, height: 13 },
  auditLog: { src: "/icons/settings-nav/audit-log.svg", width: 20, height: 20 },
} as const satisfies Record<string, SettingsNavIcon>;

export const SETTINGS_HOME_HREF = "/admin_recruiter/settings";

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Company",
    items: [
      {
        label: "Branding",
        href: SETTINGS_HOME_HREF,
        icon: ICON.branding,
        resourceKey: "settings_company",
        matchPrefixes: [SETTINGS_HOME_HREF],
        matchExact: true,
        section: "branding",
      },
      {
        label: "Roles & Permissions",
        href: `${SETTINGS_HOME_HREF}/roles`,
        icon: ICON.roles,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/roles`],
        section: "roles",
      },
      {
        label: "Departments",
        href: `${SETTINGS_HOME_HREF}/departments`,
        icon: ICON.departments,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/departments`],
        section: "departments",
      },
    ],
  },
  {
    label: "Hiring Setup",
    items: [
      {
        label: "Professions",
        href: `${SETTINGS_HOME_HREF}/professions`,
        icon: ICON.professions,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/professions`],
        section: "professions",
      },
      {
        label: "Statuses",
        href: `${SETTINGS_HOME_HREF}/statuses`,
        icon: ICON.statuses,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/statuses`],
        section: "statuses",
      },
      {
        label: "Assessment",
        href: `${SETTINGS_HOME_HREF}/assessment`,
        icon: ICON.assessment,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/assessment`],
        section: "assessment",
      },
      {
        label: "Templates",
        href: `${SETTINGS_HOME_HREF}/templates`,
        icon: ICON.templates,
        resourceKey: "settings_templates",
        matchPrefixes: [
          `${SETTINGS_HOME_HREF}/templates`,
          "/admin_recruiter/template-builder",
          "/admin_recruiter/email-templates",
          "/admin_recruiter/dashboard/templates",
        ],
        section: "templates",
      },
    ],
  },
  {
    label: "Workflows",
    items: [
      {
        label: "Workflows",
        href: "/admin_recruiter/dashboard/onboarding-flows",
        icon: ICON.workflows,
        resourceKey: "settings_automation",
        matchPrefixes: [
          "/admin_recruiter/dashboard/onboarding-flows",
          "/admin_recruiter/dashboard/onboarding-builder",
          "/admin_recruiter/dashboard/workflow-mappings",
          "/admin_recruiter/dashboard/workflowlibrary",
        ],
      },
      {
        label: "Schedule & PTO",
        href: `${SETTINGS_HOME_HREF}/schedule`,
        icon: ICON.workflows,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/schedule`],
        section: "schedule",
      },
    ],
  },
  {
    label: "Alerts & Connections",
    items: [
      {
        label: "Notifications",
        href: "/admin_recruiter/notifications",
        icon: ICON.notifications,
        resourceKey: "settings_notifications",
        matchPrefixes: ["/admin_recruiter/notifications"],
      },
      {
        label: "Integrations",
        href: `${SETTINGS_HOME_HREF}/integrations`,
        icon: ICON.integrations,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/integrations`],
        section: "integrations",
      },
    ],
  },
  {
    label: "Billing",
    items: [
      {
        label: "Plan & Billing",
        href: `${SETTINGS_HOME_HREF}/billing`,
        icon: ICON.billing,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/billing`],
        section: "billing",
      },
    ],
  },
  {
    label: "Security",
    items: [
      {
        label: "Security",
        href: `${SETTINGS_HOME_HREF}/security`,
        icon: ICON.security,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/security`],
        section: "security",
      },
      {
        label: "Audit Log",
        href: `${SETTINGS_HOME_HREF}/audit-log`,
        icon: ICON.auditLog,
        resourceKey: "settings_company",
        matchPrefixes: [`${SETTINGS_HOME_HREF}/audit-log`],
        section: "audit-log",
      },
    ],
  },
];

const SETTINGS_SECTION_SLUGS = new Set(
  SETTINGS_NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => (item.section && item.section !== "branding" ? [item.section] : []))
  )
);

export function isSettingsSectionSlug(section: string): boolean {
  return SETTINGS_SECTION_SLUGS.has(section);
}

export function isSettingsNavItemActive(pathname: string, item: SettingsNavItem): boolean {
  return item.matchPrefixes.some((prefix) =>
    item.matchExact ? pathname === prefix || pathname === `${prefix}/` : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function settingsNavMatchPrefixes(): string[] {
  return SETTINGS_NAV_GROUPS.flatMap((group) => group.items.flatMap((item) => item.matchPrefixes));
}
