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
  templateBuilder: "Template Builder",
  teams: "Teams",
  automation: "Connect",
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

const DASHBOARD_BASE = "/admin_recruiter/dashboard";
const ONBOARDING_BUILDER_ROUTE = `${DASHBOARD_BASE}/onboarding-builder`;
const WORKFLOWS_ROUTE = `${DASHBOARD_BASE}/onboarding-flows`;
const TEMPLATES_ROUTE = `${DASHBOARD_BASE}/templates`;

const DASHBOARD_CHILDREN: SidebarLink[] = [
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

const REPORTS_CHILDREN: SidebarLink[] = [
  { label: "Recruitment Reports", href: "#", matchPrefixes: [], disabled: true },
  { label: "Workforce Reports", href: "#", matchPrefixes: [], disabled: true },
  { label: "Payroll Reports", href: "#", matchPrefixes: [], disabled: true },
  { label: "Financial Reports", href: "#", matchPrefixes: [], disabled: true },
];

const SCHEDULING_CHILDREN: SidebarLink[] = [
  {
    label: "Schedule",
    href: "/admin_recruiter/calendar/shifts",
    matchPrefixes: ["/admin_recruiter/calendar/shifts"],
  },
  {
    label: "Time & Attendance",
    href: "/admin_recruiter/attendance",
    matchPrefixes: ["/admin_recruiter/attendance"],
  },
];

const TASKBOARD_CHILDREN: SidebarLink[] = [
  {
    label: "Onboarding",
    href: "#",
    matchPrefixes: [],
    disabled: true,
  },
  {
    label: "Interviews",
    href: "/admin_recruiter/calendar",
    matchPrefixes: ["/admin_recruiter/calendar"],
    matchExact: true,
  },
  {
    label: "Calls",
    href: "#",
    matchPrefixes: [],
    disabled: true,
  },
];

const TASKBOARD_ACTIVE_PREFIXES = ["/admin_recruiter/calendar"];

const EMAIL_TEMPLATES_ROUTE = "/admin_recruiter/email-templates";
const TEMPLATE_BUILDER_ROUTE = "/admin_recruiter/template-builder";

const TEMPLATES_CHILDREN: SidebarLink[] = [
  {
    label: "Email Templates",
    href: EMAIL_TEMPLATES_ROUTE,
    matchPrefixes: [EMAIL_TEMPLATES_ROUTE],
  },
  {
    label: "Template Builder",
    href: TEMPLATE_BUILDER_ROUTE,
    matchPrefixes: [TEMPLATE_BUILDER_ROUTE],
  },
];

const TEMPLATES_ACTIVE_PREFIXES = [EMAIL_TEMPLATES_ROUTE, TEMPLATE_BUILDER_ROUTE];

const RECRUITMENT_CHILDREN: SidebarLink[] = [
  {
    label: "Candidates",
    href: "/admin_recruiter/candidates",
    matchPrefixes: CANDIDATE_ROUTE_PREFIXES,
  },
];

const WORKFORCE_CHILDREN: SidebarLink[] = [
  {
    label: "Workers",
    href: "/admin_recruiter/workers",
    matchPrefixes: ["/admin_recruiter/workers"],
  },
  { label: "Managers", href: "#", matchPrefixes: [], disabled: true },
];

const AUTOMATION_CHILDREN: SidebarLink[] = [
  // {
  //   label: "Onboarding",
  //   href: ONBOARDING_BUILDER_ROUTE,
  //   matchPrefixes: [ONBOARDING_BUILDER_ROUTE],
  // }, // Hidden for now; can be uncommented later
  {
    label: "Templates",
    href: TEMPLATES_ROUTE,
    matchPrefixes: [TEMPLATES_ROUTE],
  },
  {
    label: "Library",
    href: `${DASHBOARD_BASE}/workflowlibrary`,
    matchPrefixes: [`${DASHBOARD_BASE}/workflowlibrary`],
  },
  {
    label: "Workflows",
    href: WORKFLOWS_ROUTE,
    matchPrefixes: [WORKFLOWS_ROUTE],
  },
];

const AUTOMATION_ACTIVE_PREFIXES = [
  ONBOARDING_BUILDER_ROUTE,
  TEMPLATES_ROUTE,
  `${DASHBOARD_BASE}/workflowlibrary`,
  WORKFLOWS_ROUTE,
];

const ORGANIZATION_CHILDREN: SidebarLink[] = [
  {
    label: "Locations",
    href: "/admin_recruiter/facilities",
    matchPrefixes: ["/admin_recruiter/facilities"],
  },
];

const DASHBOARD_ACTIVE_PREFIXES = [
  DASHBOARD_BASE,
  DASHBOARD_OVERVIEW_BASE,
  `${DASHBOARD_BASE}/home`,
];

const SHARED_TOP_SECTIONS: SidebarSection[] = [
  {
    label: "Dashboard",
    href: "#",
    iconType: ICON.dashboard,
    matchPrefixes: DASHBOARD_ACTIVE_PREFIXES,
    children: DASHBOARD_CHILDREN,
  },
  {
    label: "Mail",
    href: "#",
    iconType: ICON.mail,
    matchPrefixes: ["/admin_recruiter/mail"],
    disabled: true,
  },
  {
    label: "Templates",
    href: "#",
    iconType: ICON.templateBuilder,
    matchPrefixes: TEMPLATES_ACTIVE_PREFIXES,
    children: TEMPLATES_CHILDREN,
  },
  {
    label: "Taskboard",
    href: "#",
    iconType: ICON.taskboard,
    matchPrefixes: TASKBOARD_ACTIVE_PREFIXES,
    children: TASKBOARD_CHILDREN,
  },
  {
    label: "Chat",
    href: "/admin_recruiter/messages",
    iconType: ICON.chat,
    matchPrefixes: ["/admin_recruiter/messages"],
  },
  {
    label: "Scheduling",
    href: "/admin_recruiter/calendar/shifts",
    iconType: ICON.schedule,
    matchPrefixes: ["/admin_recruiter/calendar/shifts", "/admin_recruiter/attendance"],
    children: SCHEDULING_CHILDREN,
  },
  // {
  //   label: "Tickets",
  //   href: "/admin_recruiter/tickets/support",
  //   iconType: ICON.tickets,
  //   matchPrefixes: [
  //     "/admin_recruiter/tickets",
  //     "/admin_recruiter/support-tickets",
  //     "/admin_recruiter/advanced-search",
  //   ],
  //   children: [
  //     {
  //       label: "Support Tickets",
  //       href: "/admin_recruiter/tickets/support",
  //       matchPrefixes: ["/admin_recruiter/tickets/support", "/admin_recruiter/support-tickets"],
  //     },
  //     {
  //       label: "Advanced Search",
  //       href: "/admin_recruiter/advanced-search",
  //       matchPrefixes: ["/admin_recruiter/advanced-search"],
  //     },
  //   ],
  // }, // Hidden for now; can be uncommented later
  {
    label: "Reports",
    href: "/admin_recruiter/reports",
    iconType: ICON.reports,
    matchPrefixes: ["/admin_recruiter/reports"],
    children: REPORTS_CHILDREN,
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
    href: "/admin_recruiter/help-support",
    iconType: ICON.help,
    matchPrefixes: ["/admin_recruiter/help-support"],
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
    label: "Recruitment",
    href: "/admin_recruiter/candidates",
    iconType: ICON.candidates,
    matchPrefixes: CANDIDATE_ROUTE_PREFIXES,
    children: RECRUITMENT_CHILDREN,
  },
  {
    label: "Workforce",
    href: "/admin_recruiter/workers",
    iconType: ICON.teams,
    matchPrefixes: ["/admin_recruiter/workers"],
    children: WORKFORCE_CHILDREN,
  },
  {
    label: "Automation",
    href: TEMPLATES_ROUTE,
    iconType: ICON.automation,
    matchPrefixes: AUTOMATION_ACTIVE_PREFIXES,
    children: AUTOMATION_CHILDREN,
  },
  {
    label: "Organization",
    href: "#",
    iconType: ICON.organization,
    matchPrefixes: ["/admin_recruiter/facilities"],
    children: ORGANIZATION_CHILDREN,
  },
  {
    label: "Profile",
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
    label: "Recruitment",
    href: "/admin_recruiter/candidates",
    iconType: ICON.candidates,
    matchPrefixes: CANDIDATE_ROUTE_PREFIXES,
    children: RECRUITMENT_CHILDREN,
  },
  {
    label: "Workforce",
    href: "/admin_recruiter/workers",
    iconType: ICON.teams,
    matchPrefixes: ["/admin_recruiter/workers"],
    children: WORKFORCE_CHILDREN,
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
    label: "Automation",
    href: TEMPLATES_ROUTE,
    iconType: ICON.automation,
    matchPrefixes: AUTOMATION_ACTIVE_PREFIXES,
    children: AUTOMATION_CHILDREN,
  },
  {
    label: "Organization",
    href: "#",
    iconType: ICON.organization,
    matchPrefixes: ["/admin_recruiter/facilities"],
    children: ORGANIZATION_CHILDREN,
  },
  {
    label: "Profile",
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

export { ICON as SIDEBAR_ICON_TYPES };
