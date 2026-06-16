import type { SidebarIconType } from "@/app/admin_recruiter/components/sidebar-icons";

export type WorkerSidebarLink = {
  label: string;
  href?: string;
  matchPrefixes: string[];
  disabled?: boolean;
};

export type WorkerSidebarSection = {
  label: string;
  href: string;
  iconType: SidebarIconType;
  matchPrefixes: string[];
  disabled?: boolean;
  action?: "messages";
  children?: WorkerSidebarLink[];
};

const ICON = {
  dashboard: "Dashboard",
  mail: "Mail",
  chat: "Chat",
  schedule: "Schedule",
  tickets: "Tickets",
  reports: "Reports",
  finance: "Finance",
  teams: "Teams",
  account: "My Profile",
  notifications: "Notifications",
  help: "Help & Support",
  settings: "Settings",
  logout: "Logout",
} as const satisfies Record<string, SidebarIconType>;

const DASHBOARD_CHILDREN: WorkerSidebarLink[] = [
  { label: "Finance", href: "#", matchPrefixes: [], disabled: true },
];

const FINANCE_CHILDREN: WorkerSidebarLink[] = [
  { label: "Billing", href: "#", matchPrefixes: [], disabled: true },
  { label: "Invoices", href: "#", matchPrefixes: [], disabled: true },
];

const ACCOUNT_CHILDREN: WorkerSidebarLink[] = [
  { label: "My Profile", href: "/application/applicant-dashboard/profile", matchPrefixes: ["/application/applicant-dashboard/profile"] },
  { label: "Licenses", href: "/application/applicant-dashboard/licenses", matchPrefixes: ["/application/applicant-dashboard/licenses"] },
  { label: "Documents", href: "/application/applicant-dashboard/documents", matchPrefixes: ["/application/applicant-dashboard/documents"] },
];

const TEAMS_CHILDREN: WorkerSidebarLink[] = [
  { label: "Managers", href: "#", matchPrefixes: [], disabled: true },
  { label: "Teams", href: "#", matchPrefixes: [], disabled: true },
];

const PORTAL_HOME = "/application/applicant-dashboard";

/** Worker portal sidebar — matches Figma worker menu (not admin recruiter). */
export const WORKER_SIDEBAR_SECTIONS: WorkerSidebarSection[] = [
  {
    label: "Dashboard",
    href: PORTAL_HOME,
    iconType: ICON.dashboard,
    matchPrefixes: [],
    children: DASHBOARD_CHILDREN,
  },
  {
    label: "Mail",
    href: "#",
    iconType: ICON.mail,
    matchPrefixes: [],
    disabled: true,
  },
  {
    label: "Chat",
    href: "/application/applicant-dashboard/group-chat",
    iconType: ICON.chat,
    matchPrefixes: ["/application/applicant-dashboard/group-chat"],
  },
  {
    label: "Schedule",
    href: PORTAL_HOME,
    iconType: ICON.schedule,
    matchPrefixes: [PORTAL_HOME],
  },
  {
    label: "Tickets",
    href: "#",
    iconType: ICON.tickets,
    matchPrefixes: [],
    disabled: true,
  },
  {
    label: "Reports",
    href: "#",
    iconType: ICON.reports,
    matchPrefixes: [],
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
  {
    label: "Teams",
    href: "#",
    iconType: ICON.teams,
    matchPrefixes: [],
    disabled: true,
    children: TEAMS_CHILDREN,
  },
  {
    label: "Account",
    href: "/application/applicant-dashboard/profile",
    iconType: ICON.account,
    matchPrefixes: [
      "/application/applicant-dashboard/profile",
      "/application/applicant-dashboard/licenses",
      "/application/applicant-dashboard/documents",
    ],
    children: ACCOUNT_CHILDREN,
  },
  {
    label: "Notifications",
    href: "#",
    iconType: ICON.notifications,
    matchPrefixes: [],
    disabled: true,
  },
  {
    label: "Help & Support",
    href: "/application/applicant-dashboard/help",
    iconType: ICON.help,
    matchPrefixes: ["/application/applicant-dashboard/help"],
  },
  {
    label: "Settings",
    href: "#",
    iconType: ICON.settings,
    matchPrefixes: [],
    disabled: true,
  },
];

export { ICON as WORKER_SIDEBAR_ICON_TYPES };

export const WORKER_SIDEBAR_EXPANDED_WIDTH = 344;
export const WORKER_SIDEBAR_COLLAPSED_WIDTH = 80;
/** Mobile mini rail below 500px — 20% narrower than {@link WORKER_SIDEBAR_COLLAPSED_WIDTH}. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH * 0.8);
