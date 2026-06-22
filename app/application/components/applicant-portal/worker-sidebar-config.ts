import type { SidebarIconType } from "@/app/admin_recruiter/components/sidebar-icons";

export type WorkerSidebarLink = {
  label: string;
  href?: string;
  matchPrefixes: string[];
  matchExact?: boolean;
  disabled?: boolean;
};

export type WorkerSidebarSection = {
  label: string;
  href: string;
  iconType: SidebarIconType;
  matchPrefixes: string[];
  matchExact?: boolean;
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
  finance: "Finance",
  taskboard: "Taskboard",
  teams: "Teams",
  organization: "Organization",
  profile: "My Profile",
  notifications: "Notifications",
  help: "Help & Support",
  settings: "Settings",
  logout: "Logout",
} as const satisfies Record<string, SidebarIconType>;

const PORTAL_HOME = "/application/applicant-dashboard";

const MY_SHIFTS_CHILDREN: WorkerSidebarLink[] = [
  { label: "Active Shifts", href: "#", matchPrefixes: [], disabled: true },
  { label: "Applications", href: "#", matchPrefixes: [], disabled: true },
  { label: "Interviews", href: "#", matchPrefixes: [], disabled: true },
];

const SCHEDULE_HOME = "/application/applicant-dashboard/schedule";

const MY_SCHEDULE_CHILDREN: WorkerSidebarLink[] = [
  { label: "Calendar", href: "#", matchPrefixes: [], disabled: true },
  { label: "Attendance", href: "#", matchPrefixes: [], disabled: true },
  { label: "Time Tracking", href: "#", matchPrefixes: [], disabled: true },
];

const PAYROLL_CHILDREN: WorkerSidebarLink[] = [
  { label: "Payslips", href: "#", matchPrefixes: [], disabled: true },
  { label: "Earnings", href: "#", matchPrefixes: [], disabled: true },
];

const TASKBOARD_CHILDREN: WorkerSidebarLink[] = [
  { label: "Assigned Tasks", href: "#", matchPrefixes: [], disabled: true },
  { label: "Completed Tasks", href: "#", matchPrefixes: [], disabled: true },
];

const TEAMS_CHILDREN: WorkerSidebarLink[] = [
  { label: "Teams", href: "#", matchPrefixes: [], disabled: true },
  { label: "Managers", href: "#", matchPrefixes: [], disabled: true },
];

const ORGANIZATION_CHILDREN: WorkerSidebarLink[] = [
  { label: "Locations", href: "#", matchPrefixes: [], disabled: true },
];

const PROFILE_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Personal Information",
    href: "/application/applicant-dashboard/profile",
    matchPrefixes: ["/application/applicant-dashboard/profile"],
    matchExact: true,
  },
  {
    label: "Documents",
    href: "/application/applicant-dashboard/documents",
    matchPrefixes: ["/application/applicant-dashboard/documents"],
    matchExact: true,
  },
  {
    label: "Certifications",
    href: "/application/applicant-dashboard/licenses",
    matchPrefixes: ["/application/applicant-dashboard/licenses"],
    matchExact: true,
  },
];

/** Worker portal sidebar — matches Figma worker menu (not admin recruiter). */
export const WORKER_SIDEBAR_SECTIONS: WorkerSidebarSection[] = [
  {
    label: "Dashboard",
    href: PORTAL_HOME,
    iconType: ICON.dashboard,
    matchPrefixes: [PORTAL_HOME],
    matchExact: true,
  },
  {
    label: "My Shifts",
    href: "#",
    iconType: ICON.finance,
    matchPrefixes: [],
    disabled: true,
    children: MY_SHIFTS_CHILDREN,
  },
  {
    label: "Schedule",
    href: SCHEDULE_HOME,
    iconType: ICON.schedule,
    matchPrefixes: [SCHEDULE_HOME],
    children: MY_SCHEDULE_CHILDREN,
  },
  {
    label: "Payroll",
    href: "#",
    iconType: ICON.finance,
    matchPrefixes: [],
    disabled: true,
    children: PAYROLL_CHILDREN,
  },
  {
    label: "Taskboard",
    href: "#",
    iconType: ICON.taskboard,
    matchPrefixes: [],
    disabled: true,
    children: TASKBOARD_CHILDREN,
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
    label: "Organization",
    href: "#",
    iconType: ICON.organization,
    matchPrefixes: [],
    disabled: true,
    children: ORGANIZATION_CHILDREN,
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
    matchExact: true,
  },
  {
    label: "Tickets",
    href: "#",
    iconType: ICON.tickets,
    matchPrefixes: [],
    disabled: true,
  },
  {
    label: "Profile",
    href: "/application/applicant-dashboard/profile",
    iconType: ICON.profile,
    matchPrefixes: [
      "/application/applicant-dashboard/profile",
      "/application/applicant-dashboard/documents",
      "/application/applicant-dashboard/licenses",
    ],
    children: PROFILE_CHILDREN,
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
    matchExact: true,
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

export const WORKER_SIDEBAR_EXPANDED_WIDTH = 272;
export const WORKER_SIDEBAR_COLLAPSED_WIDTH = 80;
/** Mobile mini rail below 500px — 20% narrower than {@link WORKER_SIDEBAR_COLLAPSED_WIDTH}. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH * 0.8);
