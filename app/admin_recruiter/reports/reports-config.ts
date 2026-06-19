import {
  Activity,
  BarChart3,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  GitBranch,
  Home,
  LineChart,
  Rocket,
  Shield,
  Timer,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ReportCategoryId =
  | "all"
  | "recruiting"
  | "applicants-candidates"
  | "workforce"
  | "time-attendance"
  | "payroll"
  | "finance"
  | "compliance"
  | "performance"
  | "custom";

export type ReportCategory = {
  id: ReportCategoryId;
  label: string;
  icon: LucideIcon;
};

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ReportCategoryId, "all">;
  icon: LucideIcon;
  iconBg: string;
  href?: string;
  featured?: boolean;
  suggested?: boolean;
};

export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: "all", label: "All Reports", icon: Home },
  { id: "recruiting", label: "Recruiting", icon: Briefcase },
  { id: "applicants-candidates", label: "Applicants & Candidates", icon: UserCheck },
  { id: "workforce", label: "Workforce Management", icon: Users },
  { id: "time-attendance", label: "Time & Attendance", icon: Clock },
  { id: "payroll", label: "Payroll & Compensation", icon: Wallet },
  { id: "finance", label: "Finance", icon: LineChart },
  { id: "compliance", label: "Compliance", icon: Shield },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "custom", label: "Custom Reports", icon: FileText },
];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "team-productivity",
    title: "Team Productivity KPI",
    description: "Compare your teams performance for candidate processing actions.",
    category: "recruiting",
    icon: Rocket,
    iconBg: "#FFECD6",
    href: "/admin_recruiter/reports/team-productivity",
    featured: true,
    suggested: true,
  },
  {
    id: "job-pipeline",
    title: "Job Pipeline",
    description: "Overview of the current state of jobs and active candidates per stage.",
    category: "recruiting",
    icon: GitBranch,
    iconBg: "#FFF1BF",
    suggested: true,
  },
  {
    id: "activity-log",
    title: "Activity Log",
    description: "See a log of team's activity on jobs, candidates and requisitions.",
    category: "recruiting",
    icon: Activity,
    iconBg: "#D6FFE6",
    suggested: true,
  },
  {
    id: "candidate-details",
    title: "Candidate Details",
    description: "Customize a table of candidate profile details.",
    category: "applicants-candidates",
    icon: User,
    iconBg: "#D6E2FF",
    suggested: true,
  },
  {
    id: "candidate-resources",
    title: "Candidate Resources",
    description: "See how each hiring source performs, incl. job boards, recruiters & more.",
    category: "applicants-candidates",
    icon: UserCheck,
    iconBg: "#D6FFE6",
    suggested: true,
  },
  {
    id: "employee-details",
    title: "Employee Details",
    description: "Customize a table of employee profile details.",
    category: "workforce",
    icon: Users,
    iconBg: "#D6E2FF",
    suggested: true,
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "View, filter and export your employee's attendance information.",
    category: "time-attendance",
    icon: Clock,
    iconBg: "#FFD6D6",
    suggested: true,
  },
  {
    id: "time-off-requests",
    title: "Time-off Requests",
    description: "View time-off requests, organized by time-off type and date range.",
    category: "time-attendance",
    icon: Timer,
    iconBg: "#F8D6FF",
    suggested: true,
  },
  {
    id: "payroll-summary",
    title: "Payroll Summary",
    description: "View payroll summary by pay period, department or facility location.",
    category: "payroll",
    icon: DollarSign,
    iconBg: "#D6F4FF",
    suggested: true,
  },
  {
    id: "salary-estimator",
    title: "Salary Estimator",
    description: "Estimate salary costs by role, department or facility location.",
    category: "payroll",
    icon: BarChart3,
    iconBg: "#EFFFD8",
    suggested: true,
  },
  {
    id: "compliance-overview",
    title: "Compliance Overview",
    description: "Track expiring documents, training and compliance status.",
    category: "compliance",
    icon: Shield,
    iconBg: "#CCFBF1",
    suggested: true,
  },
  {
    id: "performance-summary",
    title: "Performance Summary",
    description: "View performance ratings and goals progress across your organization.",
    category: "performance",
    icon: TrendingUp,
    iconBg: "#EAF1FF",
    suggested: true,
  },
  {
    id: "hiring-funnel",
    title: "Hiring Funnel",
    description: "Track candidate progression through each stage of the hiring process.",
    category: "recruiting",
    icon: GitBranch,
    iconBg: "#FFF1BF",
  },
  {
    id: "source-of-hire",
    title: "Source of Hire",
    description: "Analyze which channels deliver the most successful hires.",
    category: "recruiting",
    icon: Briefcase,
    iconBg: "#FFECD6",
  },
  {
    id: "time-to-hire",
    title: "Time to Hire",
    description: "Measure average days from application to offer acceptance.",
    category: "recruiting",
    icon: Clock,
    iconBg: "#D6FFE6",
  },
  {
    id: "requisition-status",
    title: "Requisition Status",
    description: "Monitor open, filled, and on-hold requisitions across departments.",
    category: "recruiting",
    icon: FileText,
    iconBg: "#D6E2FF",
  },
  {
    id: "offer-acceptance",
    title: "Offer Acceptance Rate",
    description: "Track offer extended vs. accepted across roles and locations.",
    category: "recruiting",
    icon: TrendingUp,
    iconBg: "#EAF1FF",
  },
  {
    id: "candidate-pipeline",
    title: "Candidate Pipeline",
    description: "View candidates grouped by stage, source, and recruiter.",
    category: "applicants-candidates",
    icon: UserCheck,
    iconBg: "#D6FFE6",
  },
  {
    id: "applicant-volume",
    title: "Applicant Volume",
    description: "Trend applicant volume by job, location, and time period.",
    category: "applicants-candidates",
    icon: BarChart3,
    iconBg: "#FFF1BF",
  },
  {
    id: "interview-schedule",
    title: "Interview Schedule",
    description: "Review upcoming and completed interviews by recruiter and role.",
    category: "applicants-candidates",
    icon: Clock,
    iconBg: "#FFD6D6",
  },
  {
    id: "headcount",
    title: "Headcount Report",
    description: "Current workforce headcount by department, role, and facility.",
    category: "workforce",
    icon: Users,
    iconBg: "#D6FFE6",
  },
  {
    id: "turnover",
    title: "Turnover Analysis",
    description: "Track voluntary and involuntary separations over time.",
    category: "workforce",
    icon: Activity,
    iconBg: "#FFD6D6",
  },
  {
    id: "onboarding-status",
    title: "Onboarding Status",
    description: "Monitor new hire onboarding progress and completion rates.",
    category: "workforce",
    icon: Rocket,
    iconBg: "#FFECD6",
  },
  {
    id: "timesheet-summary",
    title: "Timesheet Summary",
    description: "Review submitted and approved timesheets by pay period.",
    category: "time-attendance",
    icon: Clock,
    iconBg: "#D6F4FF",
  },
  {
    id: "overtime",
    title: "Overtime Report",
    description: "Track overtime hours by employee, department, and facility.",
    category: "time-attendance",
    icon: Timer,
    iconBg: "#F8D6FF",
  },
  {
    id: "pto-balance",
    title: "PTO Balance",
    description: "View accrued and used PTO balances across your workforce.",
    category: "time-attendance",
    icon: Wallet,
    iconBg: "#EFFFD8",
  },
  {
    id: "compensation-analysis",
    title: "Compensation Analysis",
    description: "Compare pay bands and compensation across roles and locations.",
    category: "payroll",
    icon: DollarSign,
    iconBg: "#FFF1BF",
  },
  {
    id: "tax-summary",
    title: "Tax Summary",
    description: "Payroll tax withholdings and employer tax liability by period.",
    category: "payroll",
    icon: FileText,
    iconBg: "#CCFBF1",
  },
  {
    id: "benefits-enrollment",
    title: "Benefits Enrollment",
    description: "Enrollment status and participation rates by benefit plan.",
    category: "payroll",
    icon: Shield,
    iconBg: "#D6E2FF",
  },
  {
    id: "revenue-by-facility",
    title: "Revenue by Facility",
    description: "Revenue breakdown by facility, department, and service line.",
    category: "finance",
    icon: LineChart,
    iconBg: "#EAF1FF",
  },
  {
    id: "cost-per-hire",
    title: "Cost per Hire",
    description: "Calculate recruiting spend per hire across channels.",
    category: "finance",
    icon: DollarSign,
    iconBg: "#D6F4FF",
  },
  {
    id: "budget-variance",
    title: "Budget Variance",
    description: "Compare actual spend against budget by department.",
    category: "finance",
    icon: BarChart3,
    iconBg: "#FFF1BF",
  },
  {
    id: "invoice-aging",
    title: "Invoice Aging",
    description: "Outstanding invoices grouped by aging buckets.",
    category: "finance",
    icon: FileText,
    iconBg: "#FFECD6",
  },
  {
    id: "document-expiry",
    title: "Document Expiry",
    description: "Upcoming credential and document expirations by worker.",
    category: "compliance",
    icon: Shield,
    iconBg: "#FFD6D6",
  },
  {
    id: "training-completion",
    title: "Training Completion",
    description: "Required training completion rates by facility and role.",
    category: "compliance",
    icon: Activity,
    iconBg: "#D6FFE6",
  },
  {
    id: "audit-trail",
    title: "Audit Trail",
    description: "System activity log for compliance and security reviews.",
    category: "compliance",
    icon: FileText,
    iconBg: "#F8D6FF",
  },
  {
    id: "goal-progress",
    title: "Goal Progress",
    description: "Individual and team goal completion across review cycles.",
    category: "performance",
    icon: TrendingUp,
    iconBg: "#D6FFE6",
  },
  {
    id: "review-cycle",
    title: "Review Cycle Status",
    description: "Performance review completion by manager and department.",
    category: "performance",
    icon: Users,
    iconBg: "#FFF1BF",
  },
  {
    id: "ratings-distribution",
    title: "Ratings Distribution",
    description: "Distribution of performance ratings across the organization.",
    category: "performance",
    icon: BarChart3,
    iconBg: "#EAF1FF",
  },
  {
    id: "custom-workforce",
    title: "Custom Workforce Report",
    description: "Build a custom report from workforce data fields.",
    category: "custom",
    icon: FileText,
    iconBg: "#D6E2FF",
  },
  {
    id: "custom-recruiting",
    title: "Custom Recruiting Report",
    description: "Build a custom report from recruiting and candidate data.",
    category: "custom",
    icon: Briefcase,
    iconBg: "#FFECD6",
  },
  {
    id: "saved-reports",
    title: "Saved Reports",
    description: "Access your previously saved custom report configurations.",
    category: "custom",
    icon: FileText,
    iconBg: "#F4F4F4",
  },
];

export function getCategoryCount(categoryId: ReportCategoryId): number {
  if (categoryId === "all") return REPORT_DEFINITIONS.length;
  return REPORT_DEFINITIONS.filter((r) => r.category === categoryId).length;
}

export function getReportsForCategory(
  categoryId: ReportCategoryId,
  searchQuery: string,
  suggestedOnly = false,
): ReportDefinition[] {
  let reports = REPORT_DEFINITIONS;

  if (categoryId !== "all") {
    reports = reports.filter((r) => r.category === categoryId);
  }

  if (suggestedOnly && categoryId === "all") {
    reports = reports.filter((r) => r.suggested);
  }

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    reports = reports.filter(
      (r) =>
        r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query),
    );
  }

  return reports;
}
