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
  schedule: "Schedule",
  help: "Help & Support",
  logout: "Logout",
  time: "Time",
  pay: "Pay",
  taskboard: "Taskboard",
} as const satisfies Record<string, SidebarIconType>;

const PORTAL_HOME = "/application/applicant-dashboard";
const WORKER_HOME = "/application/home";
const SCHEDULE_HOME = `${PORTAL_HOME}/schedule`;
const TIMESHEETS_HOME = `${SCHEDULE_HOME}/timesheets`;
const PAY_HOME = `${PORTAL_HOME}/pay`;
const PAYSLIPS_HOME = `${PAY_HOME}/payslips`;
const EARNINGS_HOME = `${PAY_HOME}/earnings`;
const TASKBOARD_HOME = `${PORTAL_HOME}/taskboard`;
const SCHEDULE_ACTIVE_PREFIXES = [SCHEDULE_HOME, TIMESHEETS_HOME];
const PAY_ACTIVE_PREFIXES = [PAY_HOME, PAYSLIPS_HOME, EARNINGS_HOME];

/** Figma worker Schedule menu — Schedule (calendar) + Attendance. */
const SCHEDULE_CHILDREN: WorkerSidebarLink[] = [
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

/**
 * Worker portal sidebar — Figma "Dashboard - Main (Worker)" only:
 * Dashboard, Schedule, Time, Pay, Taskboard, Help & Support.
 */
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
    label: "Schedule",
    href: `${SCHEDULE_HOME}?view=calendar`,
    iconType: ICON.schedule,
    // Shared /schedule path with Time — activate only via children (view/tab).
    matchPrefixes: [],
    children: SCHEDULE_CHILDREN,
  },
  {
    label: "Time",
    href: SCHEDULE_HOME,
    iconType: ICON.time,
    // Shared /schedule path with Schedule — activate only via children (view/tab).
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
    label: "Help & Support",
    href: `${PORTAL_HOME}/help`,
    iconType: ICON.help,
    matchPrefixes: [`${PORTAL_HOME}/help`, `${PORTAL_HOME}/tickets`],
  },
];

export { ICON as WORKER_SIDEBAR_ICON_TYPES };

export const WORKER_SIDEBAR_EXPANDED_WIDTH = 272;
export const WORKER_SIDEBAR_COLLAPSED_WIDTH = 80;
/** Mobile mini rail below 500px — 20% narrower than {@link WORKER_SIDEBAR_COLLAPSED_WIDTH}. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH * 0.8);
/** Extra-narrow mobile rail below 430px — 25% slimmer than narrow rail. */
export const WORKER_SIDEBAR_COLLAPSED_WIDTH_MOBILE = Math.round(WORKER_SIDEBAR_COLLAPSED_WIDTH_NARROW * 0.75);
