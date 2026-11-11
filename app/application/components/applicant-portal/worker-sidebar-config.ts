import type { SidebarIconType } from "@/app/admin_recruiter/components/sidebar-icons";

export type WorkerSidebarLink = {
  label: string;
  href?: string;
  matchPrefixes: string[];
  matchExact?: boolean;
  disabled?: boolean;
  /** When set on schedule routes, only active for that view (?view=calendar vs attendance default). */
  scheduleView?: "calendar" | "attendance";
  /** When set, only active for that schedule page tab (?tab=timesheets). */
  scheduleTab?: "schedule" | "timesheets" | "notes";
  /** When set on profile routes, only active for that account tab (?tab=personal|applications). */
  accountTab?: "personal" | "applications";
};

export type WorkerSidebarSection = {
  label: string;
  href: string;
  iconType: SidebarIconType;
  matchPrefixes: string[];
  matchExact?: boolean;
  disabled?: boolean;
  /** Keep menu visible but do not navigate (e.g. Dashboard — home only via logo / login). */
  preventNavigation?: boolean;
  action?: "messages";
  children?: WorkerSidebarLink[];
};

const ICON = {
  dashboard: "Dashboard",
  mail: "Mail",
  chat: "Chat",
  schedule: "Schedule",
  shifts: "Shifts",
  tickets: "Tickets",
  finance: "Finance",
  taskboard: "Taskboard",
  teams: "Teams",
  organization: "Organization",
  jobs: "Jobs",
  profile: "My Profile",
  notifications: "Notifications",
  help: "Help & Support",
  settings: "Settings",
  logout: "Logout",
  time: "Time",
  pay: "Pay",
} as const satisfies Record<string, SidebarIconType>;

const PORTAL_HOME = "/application/applicant-dashboard";
const WORKER_HOME = "/application/home";
const SCHEDULE_HOME = `${PORTAL_HOME}/schedule`;
const TIMESHEETS_HOME = `${SCHEDULE_HOME}/timesheets`;
const PAY_HOME = `${PORTAL_HOME}/pay`;
const PAYSLIPS_HOME = `${PAY_HOME}/payslips`;
const EARNINGS_HOME = `${PAY_HOME}/earnings`;
const JOBS_HOME = `${PORTAL_HOME}/jobs`;
const SCHEDULE_ACTIVE_PREFIXES = [SCHEDULE_HOME, TIMESHEETS_HOME];
const PAY_ACTIVE_PREFIXES = [PAY_HOME, PAYSLIPS_HOME, EARNINGS_HOME];

const MY_SHIFTS_CHILDREN: WorkerSidebarLink[] = [
  { label: "Active Shifts", href: "#", matchPrefixes: [], disabled: true },
  {
    label: "Applications",
    href: "/application/applicant-dashboard/applications",
    matchPrefixes: ["/application/applicant-dashboard/applications"],
    matchExact: true,
  },
  { label: "Interviews", href: "#", matchPrefixes: [], disabled: true },
];

const MY_SCHEDULE_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Schedule",
    href: `${SCHEDULE_HOME}?view=calendar`,
    matchPrefixes: [SCHEDULE_HOME],
    matchExact: true,
    scheduleView: "calendar",
    scheduleTab: "schedule",
  },
  {
    label: "Attendance",
    href: "#",
    matchPrefixes: [],
    disabled: true,
  },
];

/** Figma worker Time menu — Time Tracking (clock) + Timesheets. */
const TIME_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Time Tracking",
    href: SCHEDULE_HOME,
    matchPrefixes: SCHEDULE_ACTIVE_PREFIXES,
    scheduleView: "attendance",
    scheduleTab: "schedule",
  },
  {
    label: "Timesheets",
    href: `${SCHEDULE_HOME}?tab=timesheets`,
    matchPrefixes: SCHEDULE_ACTIVE_PREFIXES,
    scheduleTab: "timesheets",
  },
];

/** Figma worker Pay menu — Payslips + Earnings. */
const PAY_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Payslips",
    href: PAYSLIPS_HOME,
    matchPrefixes: [PAYSLIPS_HOME],
    matchExact: true,
  },
  {
    label: "Earnings",
    href: EARNINGS_HOME,
    matchPrefixes: [EARNINGS_HOME],
    matchExact: true,
  },
];

const TEAMS_CHILDREN: WorkerSidebarLink[] = [
  { label: "Teams", href: "#", matchPrefixes: [], disabled: true },
  { label: "Managers", href: "#", matchPrefixes: [], disabled: true },
];

const LOCATIONS_HOME = "/application/applicant-dashboard/locations";
const TASKBOARD_HOME = "/application/applicant-dashboard/taskboard";

const ORGANIZATION_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Locations",
    href: LOCATIONS_HOME,
    matchPrefixes: [LOCATIONS_HOME],
    matchExact: true,
  },
];

const PROFILE_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Personal Information",
    href: "/application/applicant-dashboard/profile?tab=personal",
    matchPrefixes: ["/application/applicant-dashboard/profile"],
    matchExact: true,
    accountTab: "personal",
  },
  {
    label: "Applications",
    href: "/application/applicant-dashboard/profile?tab=applications",
    matchPrefixes: ["/application/applicant-dashboard/profile"],
    matchExact: true,
    accountTab: "applications",
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

const SETTINGS_HOME = "/application/applicant-dashboard/settings";
const SETTINGS_CHILDREN: WorkerSidebarLink[] = [
  {
    label: "Profile",
    href: `${SETTINGS_HOME}/profile`,
    matchPrefixes: [`${SETTINGS_HOME}/profile`],
    matchExact: true,
  },
  {
    label: "Account",
    href: `${SETTINGS_HOME}/account`,
    matchPrefixes: [`${SETTINGS_HOME}/account`],
    matchExact: true,
  },
];

/** Worker portal sidebar — Figma worker menu order and hierarchy. */
export const WORKER_SIDEBAR_SECTIONS: WorkerSidebarSection[] = [
  {
    label: "Dashboard",
    // Home content is only via company logo / login (`/application/home`).
    // Do not mark active on home — this item is display-only (no navigation).
    href: WORKER_HOME,
    iconType: ICON.dashboard,
    matchPrefixes: [],
    preventNavigation: true,
  },
  {
    label: "My Shifts",
    href: "#",
    iconType: ICON.shifts,
    matchPrefixes: ["/application/applicant-dashboard/applications"],
    disabled: true,
    children: MY_SHIFTS_CHILDREN,
  },
  {
    label: "My Schedule",
    href: `${SCHEDULE_HOME}?view=calendar`,
    iconType: ICON.schedule,
    // Shared /schedule path with Time — activate only via children (view/tab).
    matchPrefixes: [],
    children: MY_SCHEDULE_CHILDREN,
  },
  {
    label: "Time",
    href: SCHEDULE_HOME,
    iconType: ICON.time,
    // Shared /schedule path with My Schedule — activate only via children (view/tab).
    matchPrefixes: [],
    children: TIME_CHILDREN,
  },
  {
    label: "Pay",
    href: PAYSLIPS_HOME,
    iconType: ICON.pay,
    matchPrefixes: PAY_ACTIVE_PREFIXES,
    children: PAY_CHILDREN,
  },
  {
    label: "Taskboard",
    href: TASKBOARD_HOME,
    iconType: ICON.taskboard,
    matchPrefixes: [TASKBOARD_HOME],
    matchExact: true,
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
    matchPrefixes: [LOCATIONS_HOME],
    children: ORGANIZATION_CHILDREN,
  },
  {
    label: "Jobs",
    href: JOBS_HOME,
    iconType: ICON.jobs,
    matchPrefixes: [JOBS_HOME],
    matchExact: true,
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
    label: "Profile",
    href: "#",
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
    matchPrefixes: [
      "/application/applicant-dashboard/help",
      "/application/applicant-dashboard/tickets",
    ],
  },
  {
    label: "Settings",
    href: `${SETTINGS_HOME}/profile`,
    iconType: ICON.settings,
    matchPrefixes: [SETTINGS_HOME],
    children: SETTINGS_CHILDREN,
  },
];

export { ICON as WORKER_SIDEBAR_ICON_TYPES };

export const WORKER_SIDEBAR_EXPANDED_WIDTH = 272;
export const WORKER_SIDEBAR_COLLAPSED_WIDTH = 80;
/** Mobile mini rail below 500px — 20% narrower than {@link WORKER_SIDEBAR_COLLAPSED_WIDTH}. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH * 0.8);
/** Extra-narrow mobile rail below 430px — 25% slimmer than narrow rail. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_MOBILE = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW * 0.75);
