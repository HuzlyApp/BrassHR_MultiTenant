import type { SidebarIconType } from "@/app/admin_recruiter/components/sidebar-icons";
import { CANDIDATE_ROUTE_PREFIXES } from "@/app/admin_recruiter/components/candidates-tabs-config";

export type SidebarLink = {
  label: string;
  href: string;
  matchPrefixes: string[];
  matchExact?: boolean;
  disabled?: boolean;
};

export type SidebarSection = {
  label: string;
  href: string;
  iconType: SidebarIconType;
  matchPrefixes: string[];
  controlsActiveState?: boolean;
  disabled?: boolean;
  children?: SidebarLink[];
};

const ICON = {
  dashboard: "Dashboard",
  mail: "Mail",
  chat: "Chat",
  schedule: "Schedule",
  tickets: "Tickets",
  reports: "Reports",
  finance: "Finance",
  taskboard: "Taskboard",
  teams: "Teams",
  candidates: "Applicant",
  clients: "Clients",
  organization: "Organization",
  account: "My Profile",
  notifications: "Notifications",
  help: "Help & Support",
  settings: "Settings",
  logout: "Logout",
} as const satisfies Record<string, SidebarIconType>;

const DASHBOARD_OVERVIEW_BASE = "/admin_recruiter/dashboard/overview";

const DASHBOARD_CHILDREN: SidebarLink[] = [
  {
    label: "Overview",
    href: DASHBOARD_OVERVIEW_BASE,
    matchPrefixes: [DASHBOARD_OVERVIEW_BASE],
    matchExact: true,
  },
  {
    label: "Recruitment Analytics",
    href: `${DASHBOARD_OVERVIEW_BASE}/recruitment-analytics`,
    matchPrefixes: [`${DASHBOARD_OVERVIEW_BASE}/recruitment-analytics`],
  },
  {
    label: "Workforce Analytics",
    href: `${DASHBOARD_OVERVIEW_BASE}/workforce-analytics`,
    matchPrefixes: [`${DASHBOARD_OVERVIEW_BASE}/workforce-analytics`],
  },
  {
    label: "Financial Analytics",
    href: `${DASHBOARD_OVERVIEW_BASE}/financial-analytics`,
    matchPrefixes: [`${DASHBOARD_OVERVIEW_BASE}/financial-analytics`],
  },
  {
    label: "Operational Insights",
    href: `${DASHBOARD_OVERVIEW_BASE}/operational-insights`,
    matchPrefixes: [`${DASHBOARD_OVERVIEW_BASE}/operational-insights`],
  },
];

const FINANCE_CHILDREN: SidebarLink[] = [
  { label: "Billing", href: "#", matchPrefixes: [], disabled: true },
  { label: "Invoices", href: "#", matchPrefixes: [], disabled: true },
];

const SHARED_TOP_SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    href: "/admin_recruiter/dashboard",
    iconType: ICON.dashboard,
    matchPrefixes: ["/admin_recruiter/dashboard"],
    children: DASHBOARD_CHILDREN,
  },
  {
    label: "Mail",
    href: "/admin_recruiter/email-templates",
    iconType: ICON.mail,
    matchPrefixes: ["/admin_recruiter/email-templates"],
  },
  {
    label: "Template Builder",
    href: "/admin_recruiter/template-builder",
    iconType: ICON.taskboard,
    matchPrefixes: ["/admin_recruiter/template-builder"],
  },
  {
    label: "Chat",
    href: "/admin_recruiter/messages",
    iconType: ICON.chat,
    matchPrefixes: ["/admin_recruiter/messages"],
  },
  {
    label: "Schedule",
    href: "/admin_recruiter/calendar",
    iconType: ICON.schedule,
    matchPrefixes: ["/admin_recruiter/calendar"],
    children: [
      { label: "Interviews", href: "/admin_recruiter/calendar", matchPrefixes: ["/admin_recruiter/calendar"] },
      { label: "Shift calendar", href: "/admin_recruiter/calendar/shifts", matchPrefixes: ["/admin_recruiter/calendar/shifts"] },
    ],
  },
  {
    label: "Tickets",
    href: "/admin_recruiter/advanced-search",
    iconType: ICON.tickets,
    matchPrefixes: ["/admin_recruiter/advanced-search"],
  },
  {
    label: "Reports",
    href: "/admin_recruiter/dashboard",
    iconType: ICON.reports,
    matchPrefixes: ["/admin_recruiter/dashboard"],
    disabled: true,
  },
  {
    label: "Finance",
    href: "#",
    iconType: ICON.finance,
    matchPrefixes: [],
    disabled: true,
    children: FINANCE_CHILDREN,
  },
];

const SHARED_FOOTER_SECTIONS: SidebarSection[] = [
  {
    label: "Help & Support",
    href: "/admin_recruiter/settings",
    iconType: ICON.help,
    matchPrefixes: ["/admin_recruiter/settings"],
    controlsActiveState: false,
  },
  {
    label: "Settings",
    href: "/admin_recruiter/settings",
    iconType: ICON.settings,
    matchPrefixes: ["/admin_recruiter/settings"],
  },
];

/** Company owner / admin recruiter (client login). */
export const CLIENT_SIDEBAR_SECTIONS: SidebarSection[] = [
  ...SHARED_TOP_SECTIONS,
  {
    label: "Taskboard",
    href: "#",
    iconType: ICON.taskboard,
    matchPrefixes: ["/admin_recruiter/dashboard/onboarding-builder"],
    children: [
      { label: "Interviews", href: "/admin_recruiter/calendar", matchPrefixes: ["/admin_recruiter/calendar"] },
      {
        label: "Onboarding",
        href: "/admin_recruiter/settings?tab=onboarding-builder",
        matchPrefixes: ["/admin_recruiter/dashboard/onboarding-builder"],
      },
    ],
  },
  {
    label: "Teams",
    href: "#",
    iconType: ICON.teams,
    matchPrefixes: [],
    children: [
      { label: "Admins", href: "#", matchPrefixes: [], disabled: true },
      { label: "Managers", href: "#", matchPrefixes: [], disabled: true },
      { label: "Workers", href: "/admin_recruiter/workers", matchPrefixes: ["/admin_recruiter/workers"] },
    ],
  },
  {
    label: "Candidates",
    href: "/admin_recruiter/candidates",
    iconType: ICON.candidates,
    matchPrefixes: CANDIDATE_ROUTE_PREFIXES,
  },
  {
    label: "Facilities",
    href: "/admin_recruiter/facilities",
    iconType: ICON.organization,
    matchPrefixes: ["/admin_recruiter/facilities"],
  },
  {
    label: "Organization",
    href: "/admin_recruiter/account/business-info",
    iconType: ICON.organization,
    matchPrefixes: ["/admin_recruiter/account/business-info"],
  },
  {
    label: "Account",
    href: "/admin_recruiter/account/personal",
    iconType: ICON.account,
    matchPrefixes: ["/admin_recruiter/account"],
  },
  {
    label: "Notifications",
    href: "/admin_recruiter/notifications",
    iconType: ICON.notifications,
    matchPrefixes: ["/admin_recruiter/notifications"],
  },
  ...SHARED_FOOTER_SECTIONS,
];

/** Brass HR platform god admin viewing admin recruiter. */
export const GOD_ADMIN_SIDEBAR_SECTIONS: SidebarSection[] = [
  ...SHARED_TOP_SECTIONS,
  {
    label: "Taskboard",
    href: "#",
    iconType: ICON.taskboard,
    matchPrefixes: ["/admin_recruiter/dashboard/onboarding-builder"],
    children: [
      { label: "Interviews", href: "/admin_recruiter/calendar", matchPrefixes: ["/admin_recruiter/calendar"] },
      {
        label: "Client Onboarding",
        href: "/admin_recruiter/settings?tab=onboarding-builder",
        matchPrefixes: ["/admin_recruiter/dashboard/onboarding-builder"],
      },
    ],
  },
  {
    label: "Clients",
    href: "/godadmin/tenants",
    iconType: ICON.clients,
    matchPrefixes: ["/godadmin/tenants", "/godadmin"],
    children: [
      { label: "All Clients", href: "/godadmin/tenants", matchPrefixes: ["/godadmin/tenants", "/godadmin"] },
      { label: "Organization", href: "#", matchPrefixes: [], disabled: true },
      { label: "Facilities", href: "/admin_recruiter/facilities", matchPrefixes: ["/admin_recruiter/facilities"] },
    ],
  },
  {
    label: "Facilities",
    href: "/admin_recruiter/facilities",
    iconType: ICON.organization,
    matchPrefixes: ["/admin_recruiter/facilities"],
  },
  {
    label: "Teams",
    href: "#",
    iconType: ICON.teams,
    matchPrefixes: CANDIDATE_ROUTE_PREFIXES.concat([
      "/admin_recruiter/account",
      "/admin_recruiter/notifications",
    ]),
    children: [
      { label: "Candidates", href: "/admin_recruiter/candidates", matchPrefixes: CANDIDATE_ROUTE_PREFIXES },
      { label: "Account", href: "/admin_recruiter/account/personal", matchPrefixes: ["/admin_recruiter/account"] },
      {
        label: "Notifications",
        href: "/admin_recruiter/notifications",
        matchPrefixes: ["/admin_recruiter/notifications"],
      },
    ],
  },
  ...SHARED_FOOTER_SECTIONS,
];

export { ICON as SIDEBAR_ICON_TYPES };
