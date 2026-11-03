import type { SupabaseClient } from "@supabase/supabase-js";
import { labelForRole, loadStaffRoles, staffStorageKeys } from "@/lib/admin/staff-roles";
import { listDepartments } from "@/lib/departments/service";
import {
  engagementRatio,
  formatMetricDisplay,
  jobCoverage,
  periodOverPeriodChange,
  recruiterActivityRate,
  type MetricAvailability,
  type PeriodChange,
} from "@/lib/analytics/kpi-formulas";
import { parsePreset, resolvePeriod, toIso, type DateRangePreset } from "@/lib/analytics/period";
import { expireStaleSessions } from "@/lib/analytics/sessions";
import { RECRUITING_MEANINGFUL_EVENT_TYPES } from "@/lib/analytics/activity-events";

export type TeamProductivityFilters = {
  preset?: string | null;
  customStart?: string | null;
  customEnd?: string | null;
  departmentIds?: string[];
  employeeIds?: string[];
  roles?: string[];
  activityTypes?: string[];
  jobId?: string | null;
};

export type MetricCard = {
  key: string;
  label: string;
  value: number | null;
  display: string;
  previous: number | null;
  changePct: number | null;
  direction: PeriodChange["direction"];
  availability: MetricAvailability;
  explanation: string;
  unit?: string;
};

export type EmployeePerformanceRow = {
  employeeId: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  role: string;
  roleLabel: string;
  engagedHours: number | null;
  loginHours: number | null;
  idleHours: number | null;
  jobsWorked: number | null;
  tasksDone: number | null;
  activityCount: number | null;
  targetAttainment: number | null;
  availability: {
    engagedHours: MetricAvailability;
    jobsWorked: MetricAvailability;
    activityCount: MetricAvailability;
  };
};

export type DepartmentSummary = {
  departmentId: string | null;
  name: string;
  employeeCount: number;
  activeEmployees: number;
  engagedHours: number | null;
  activityCount: number | null;
  jobsWorked: number | null;
};

export type SessionHistoryRow = {
  sessionId: string;
  employeeId: string;
  employeeName: string;
  loginAt: string;
  logoutAt: string | null;
  sessionHours: number;
  engagedHours: number;
  idleHours: number;
  activities: number;
  isActive: boolean;
};

export type ActivityTimelineItem = {
  id: string;
  occurredAt: string;
  eventType: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  jobId: string | null;
  actorUserId: string | null;
  attributionType: string;
  source: string;
  description: string;
};

export type TeamProductivityPayload = {
  generatedAt: string;
  dataFreshness: {
    lastActivityAt: string | null;
    lastSessionHeartbeatAt: string | null;
    note: string;
  };
  disclosure: string;
  period: {
    preset: DateRangePreset;
    label: string;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  filtersApplied: TeamProductivityFilters;
  tabs: Array<{ id: string; label: string; available: boolean }>;
  overview: {
    cards: MetricCard[];
    activityTrend: Array<{ date: string; label: string; value: number }>;
    engagedTrend: Array<{ date: string; label: string; value: number | null }>;
    departmentBars: Array<{ dept: string; value: number | null; available: boolean }>;
  };
  departments: DepartmentSummary[];
  employees: EmployeePerformanceRow[];
  sessions: {
    activeCount: number;
    history: SessionHistoryRow[];
  };
  recruitment: {
    available: boolean;
    note: string;
    totals: {
      meaningfulActions: number | null;
      distinctJobsWorked: number | null;
      interviewsScheduled: number | null;
      hiresAttributed: number | null;
    };
  };
  hr: { available: boolean; note: string };
  finance: { available: boolean; note: string };
  scorecards: { available: boolean; note: string };
};

function hoursFromSeconds(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  return Math.round((seconds / 3600) * 100) / 100;
}

function availabilityFromNull(value: number | null): MetricAvailability {
  return value == null ? "missing" : "available";
}

function cardFromChange(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
  explanation: string,
  unit?: string,
): MetricCard {
  const change = periodOverPeriodChange(current, previous);
  const availability = availabilityFromNull(current);
  return {
    key,
    label,
    value: current,
    display: formatMetricDisplay(current, availability),
    previous,
    changePct: change.changePct,
    direction: change.direction,
    availability,
    explanation,
    unit,
  };
}

function parseList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function filtersFromSearchParams(params: URLSearchParams): TeamProductivityFilters {
  return {
    preset: params.get("preset"),
    customStart: params.get("start"),
    customEnd: params.get("end"),
    departmentIds: parseList(params.get("departmentIds")),
    employeeIds: parseList(params.get("employeeIds")),
    roles: parseList(params.get("roles")),
    activityTypes: parseList(params.get("activityTypes")),
    jobId: params.get("jobId"),
  };
}

type StaffMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  departmentId: string | null;
};

async function loadStaffMembers(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<StaffMember[]> {
  const catalog = await loadStaffRoles(supabase);
  const staffRoles = new Set(staffStorageKeys(catalog));

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role, is_active")
    .eq("tenant_id", tenantId);

  const membershipIds = new Set(
    ((roleRows ?? []) as Array<{ user_id: string; role: string | null; is_active?: boolean | null }>)
      .filter((row) => staffRoles.has(String(row.role ?? "").trim().toLowerCase()))
      .filter((row) => row.is_active !== false)
      .map((row) => row.user_id),
  );

  let userQuery = await supabase
    .from("users")
    .select("id, email, first_name, last_name, role, department_id")
    .eq("tenant_id", tenantId)
    .order("first_name", { ascending: true });

  // department_id is added by the analytics migration; fall back if not applied yet.
  if (userQuery.error && /department_id/i.test(userQuery.error.message)) {
    userQuery = (await supabase
      .from("users")
      .select("id, email, first_name, last_name, role")
      .eq("tenant_id", tenantId)
      .order("first_name", { ascending: true })) as typeof userQuery;
  }

  if (userQuery.error) throw userQuery.error;
  const data = (userQuery.data ?? []).map((row) => ({
    ...row,
    department_id: (row as { department_id?: string | null }).department_id ?? null,
  }));

  let extra: Array<{
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    department_id: string | null;
  }> = [];
  const missingIds = [...membershipIds].filter((id) => !data.some((row) => String(row.id) === id));
  if (missingIds.length > 0) {
    let extraResult = await supabase
      .from("users")
      .select("id, email, first_name, last_name, role, department_id")
      .in("id", missingIds);
    if (extraResult.error && /department_id/i.test(extraResult.error.message)) {
      extraResult = (await supabase
        .from("users")
        .select("id, email, first_name, last_name, role")
        .in("id", missingIds)) as typeof extraResult;
    }
    extra = ((extraResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      email: (row.email as string | null) ?? null,
      first_name: (row.first_name as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
      role: (row.role as string | null) ?? null,
      department_id: (row.department_id as string | null) ?? null,
    }));
  }

  return [...data, ...extra]
    .filter(
      (row) =>
        staffRoles.has(String(row.role ?? "").trim().toLowerCase()) || membershipIds.has(String(row.id)),
    )
    .map((row) => ({
      id: String(row.id),
      email: String(row.email ?? "").trim().toLowerCase(),
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || String(row.email ?? ""),
      role: String(row.role ?? ""),
      roleLabel: labelForRole(row.role, catalog) ?? String(row.role ?? "Staff"),
      departmentId: row.department_id ? String(row.department_id) : null,
    }))
    .filter((row) => row.email.includes("@"));
}

function buildDailyTrend(
  timestamps: string[],
  start: Date,
  end: Date,
): Array<{ date: string; label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: Array<{ date: string; label: string; value: number }> = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    points.push({
      date: key,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: counts.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export async function buildTeamProductivityPayload(
  supabase: SupabaseClient,
  tenantId: string,
  filters: TeamProductivityFilters,
  options?: { viewerUserId?: string | null; canViewAllEmployees?: boolean },
): Promise<TeamProductivityPayload> {
  const period = resolvePeriod(parsePreset(filters.preset), {
    customStart: filters.customStart,
    customEnd: filters.customEnd,
  });
  const startIso = toIso(period.start);
  const endIso = toIso(period.end);
  const prevStartIso = toIso(period.previousStart);
  const prevEndIso = toIso(period.previousEnd);

  await expireStaleSessions(supabase, tenantId).catch(() => 0);

  const [departments, staff, settingsResult] = await Promise.all([
    listDepartments(supabase, tenantId),
    loadStaffMembers(supabase, tenantId),
    supabase
      .from("analytics_tenant_settings")
      .select("engagement_disclosure, idle_threshold_seconds")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  const settingsRow = {
    data:
      settingsResult.error &&
      /(does not exist|Could not find the table|schema cache)/i.test(settingsResult.error.message)
        ? null
        : settingsResult.data,
  };

  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  let visibleStaff = staff;

  if (!options?.canViewAllEmployees && options?.viewerUserId) {
    visibleStaff = staff.filter((m) => m.id === options.viewerUserId);
  }
  if (filters.departmentIds && filters.departmentIds.length > 0) {
    const set = new Set(filters.departmentIds);
    visibleStaff = visibleStaff.filter((m) => m.departmentId && set.has(m.departmentId));
  }
  if (filters.employeeIds && filters.employeeIds.length > 0) {
    const set = new Set(filters.employeeIds);
    visibleStaff = visibleStaff.filter((m) => set.has(m.id));
  }
  if (filters.roles && filters.roles.length > 0) {
    const set = new Set(filters.roles.map((r) => r.toLowerCase()));
    visibleStaff = visibleStaff.filter((m) => set.has(m.role.toLowerCase()));
  }

  const staffIds = visibleStaff.map((m) => m.id);

  const [
    activityCurrent,
    activityPrevious,
    recruiterLogsCurrent,
    recruiterLogsPrevious,
    sessionsCurrent,
    sessionsActive,
    jobsAssigned,
  ] = await Promise.all([
    supabase
      .from("analytics_activity_events")
      .select(
        "id, actor_user_id, event_type, module, entity_type, entity_id, job_id, occurred_at, department_id_at_event, attribution_type, source, metadata",
      )
      .eq("tenant_id", tenantId)
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .limit(5000),
    supabase
      .from("analytics_activity_events")
      .select("id, actor_user_id, event_type, job_id, occurred_at")
      .eq("tenant_id", tenantId)
      .gte("occurred_at", prevStartIso)
      .lte("occurred_at", prevEndIso)
      .limit(5000),
    supabase
      .from("recruiter_activity_logs")
      .select("id, recruiter_user_id, activity_type, job_id, candidate_id, created_at, action_label")
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(5000),
    supabase
      .from("recruiter_activity_logs")
      .select("id, recruiter_user_id, activity_type, job_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", prevStartIso)
      .lte("created_at", prevEndIso)
      .limit(5000),
    supabase
      .from("analytics_user_sessions")
      .select(
        "id, user_id, started_at, ended_at, logged_in_seconds, engaged_seconds, idle_seconds, activity_count, is_active, logout_at",
      )
      .eq("tenant_id", tenantId)
      .gte("started_at", startIso)
      .lte("started_at", endIso)
      .limit(5000),
    supabase
      .from("analytics_user_sessions")
      .select("id, user_id, last_heartbeat_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .limit(2000),
    supabase
      .from("job_requisitions")
      .select("id, assigned_recruiter_user_id, department_id, status")
      .eq("tenant_id", tenantId)
      .not("assigned_recruiter_user_id", "is", null)
      .limit(5000),
  ]);

  const missingRelation = (message: string | undefined) =>
    Boolean(message && /(does not exist|Could not find the table|schema cache)/i.test(message));

  if (recruiterLogsCurrent.error) throw recruiterLogsCurrent.error;
  if (recruiterLogsPrevious.error) throw recruiterLogsPrevious.error;
  if (jobsAssigned.error) throw jobsAssigned.error;
  if (activityCurrent.error && !missingRelation(activityCurrent.error.message)) {
    throw activityCurrent.error;
  }
  if (activityPrevious.error && !missingRelation(activityPrevious.error.message)) {
    throw activityPrevious.error;
  }
  if (sessionsCurrent.error && !missingRelation(sessionsCurrent.error.message)) {
    throw sessionsCurrent.error;
  }
  if (sessionsActive.error && !missingRelation(sessionsActive.error.message)) {
    throw sessionsActive.error;
  }

  type ActRow = {
    id: string;
    actor_user_id: string | null;
    event_type: string;
    module?: string;
    entity_type?: string | null;
    entity_id?: string | null;
    job_id: string | null;
    occurred_at: string;
    department_id_at_event?: string | null;
    attribution_type?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  };
  type LogRow = {
    id: string;
    recruiter_user_id: string | null;
    activity_type: string;
    job_id: string | null;
    created_at: string;
    action_label?: string;
  };
  type SessionRow = {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    logged_in_seconds: number;
    engaged_seconds: number;
    idle_seconds: number;
    activity_count: number;
    is_active: boolean;
    logout_at: string | null;
  };

  let activities = (missingRelation(activityCurrent.error?.message) ? [] : activityCurrent.data ?? []) as ActRow[];
  let prevActivities = (missingRelation(activityPrevious.error?.message)
    ? []
    : activityPrevious.data ?? []) as ActRow[];
  let logs = (recruiterLogsCurrent.data ?? []) as LogRow[];
  let prevLogs = (recruiterLogsPrevious.data ?? []) as LogRow[];
  let sessions = (missingRelation(sessionsCurrent.error?.message) ? [] : sessionsCurrent.data ?? []) as SessionRow[];
  const activeSessions = (missingRelation(sessionsActive.error?.message)
    ? []
    : sessionsActive.data ?? []) as Array<{
    id: string;
    user_id: string;
    last_heartbeat_at: string;
  }>;
  const assignedJobs = (jobsAssigned.data ?? []) as Array<{
    id: string;
    assigned_recruiter_user_id: string | null;
    department_id: string | null;
    status: string | null;
  }>;

  const staffIdSet = new Set(staffIds);
  if (staffIdSet.size > 0) {
    activities = activities.filter((a) => a.actor_user_id && staffIdSet.has(a.actor_user_id));
    prevActivities = prevActivities.filter((a) => a.actor_user_id && staffIdSet.has(a.actor_user_id));
    logs = logs.filter((l) => l.recruiter_user_id && staffIdSet.has(l.recruiter_user_id));
    prevLogs = prevLogs.filter((l) => l.recruiter_user_id && staffIdSet.has(l.recruiter_user_id));
    sessions = sessions.filter((s) => staffIdSet.has(s.user_id));
  }

  if (filters.activityTypes && filters.activityTypes.length > 0) {
    const set = new Set(filters.activityTypes);
    activities = activities.filter((a) => set.has(a.event_type));
    logs = logs.filter((l) => set.has(l.activity_type));
  }
  if (filters.jobId) {
    activities = activities.filter((a) => a.job_id === filters.jobId);
    logs = logs.filter((l) => l.job_id === filters.jobId);
  }

  const meaningfulSet = new Set<string>(RECRUITING_MEANINGFUL_EVENT_TYPES as readonly string[]);

  const activityByUser = new Map<string, ActRow[]>();
  for (const row of activities) {
    if (!row.actor_user_id) continue;
    const list = activityByUser.get(row.actor_user_id) ?? [];
    list.push(row);
    activityByUser.set(row.actor_user_id, list);
  }
  const logsByUser = new Map<string, LogRow[]>();
  for (const row of logs) {
    if (!row.recruiter_user_id) continue;
    const list = logsByUser.get(row.recruiter_user_id) ?? [];
    list.push(row);
    logsByUser.set(row.recruiter_user_id, list);
  }
  const sessionsByUser = new Map<string, SessionRow[]>();
  for (const row of sessions) {
    const list = sessionsByUser.get(row.user_id) ?? [];
    list.push(row);
    sessionsByUser.set(row.user_id, list);
  }

  const assignedByUser = new Map<string, string[]>();
  for (const job of assignedJobs) {
    if (!job.assigned_recruiter_user_id) continue;
    if (staffIdSet.size > 0 && !staffIdSet.has(job.assigned_recruiter_user_id)) continue;
    const list = assignedByUser.get(job.assigned_recruiter_user_id) ?? [];
    list.push(job.id);
    assignedByUser.set(job.assigned_recruiter_user_id, list);
  }

  const employees: EmployeePerformanceRow[] = visibleStaff.map((member) => {
    const userSessions = sessionsByUser.get(member.id) ?? [];
    const userActs = activityByUser.get(member.id) ?? [];
    const userLogs = logsByUser.get(member.id) ?? [];

    const engagedSeconds =
      userSessions.length > 0
        ? userSessions.reduce((sum, s) => sum + (Number(s.engaged_seconds) || 0), 0)
        : null;
    const loginSeconds =
      userSessions.length > 0
        ? userSessions.reduce((sum, s) => sum + (Number(s.logged_in_seconds) || 0), 0)
        : null;
    const idleSeconds =
      userSessions.length > 0
        ? userSessions.reduce((sum, s) => sum + (Number(s.idle_seconds) || 0), 0)
        : null;

    const jobIds = new Set<string>();
    for (const a of userActs) if (a.job_id) jobIds.add(a.job_id);
    for (const l of userLogs) if (l.job_id) jobIds.add(l.job_id);
    const jobsWorked = jobIds.size > 0 || userActs.length > 0 || userLogs.length > 0 ? jobIds.size : null;

    const activityCount =
      userActs.length + userLogs.length > 0 ? userActs.length + userLogs.length : null;

    const meaningful =
      userActs.filter((a) => meaningfulSet.has(a.event_type)).length +
      userLogs.length;
    const engagedHours = hoursFromSeconds(engagedSeconds);
    const activityRate = recruiterActivityRate(
      meaningful > 0 ? meaningful : null,
      engagedHours != null && engagedHours > 0 ? engagedHours : null,
    );
    const coverage = jobCoverage(
      jobsWorked,
      (assignedByUser.get(member.id) ?? []).length || null,
    );

    return {
      employeeId: member.id,
      name: member.name,
      email: member.email,
      departmentId: member.departmentId,
      departmentName: member.departmentId ? deptNameById.get(member.departmentId) ?? null : null,
      role: member.role,
      roleLabel: member.roleLabel,
      engagedHours,
      loginHours: hoursFromSeconds(loginSeconds),
      idleHours: hoursFromSeconds(idleSeconds),
      jobsWorked,
      tasksDone: null, // No general tasks table yet
      activityCount,
      targetAttainment:
        activityRate.value != null
          ? activityRate.value
          : coverage.value,
      availability: {
        engagedHours: availabilityFromNull(engagedHours),
        jobsWorked: availabilityFromNull(jobsWorked),
        activityCount: availabilityFromNull(activityCount),
      },
    };
  });

  const totalEmployees = visibleStaff.length;
  const employeesWithActivity = employees.filter((e) => (e.activityCount ?? 0) > 0).length;
  const activeNow = activeSessions.filter((s) => staffIdSet.size === 0 || staffIdSet.has(s.user_id)).length;

  const totalEngagedSeconds = sessions.reduce((sum, s) => sum + (Number(s.engaged_seconds) || 0), 0);
  const totalLoginSeconds = sessions.reduce((sum, s) => sum + (Number(s.logged_in_seconds) || 0), 0);
  const hasSessionData = sessions.length > 0;

  const prevSessionAgg = await supabase
    .from("analytics_user_sessions")
    .select("engaged_seconds, logged_in_seconds, user_id")
    .eq("tenant_id", tenantId)
    .gte("started_at", prevStartIso)
    .lte("started_at", prevEndIso)
    .limit(5000);

  const prevSessions = ((prevSessionAgg.data ?? []) as Array<{
    engaged_seconds: number;
    logged_in_seconds: number;
    user_id: string;
  }>).filter((s) => staffIdSet.size === 0 || staffIdSet.has(s.user_id));

  const prevEngaged = prevSessions.length
    ? prevSessions.reduce((sum, s) => sum + (Number(s.engaged_seconds) || 0), 0)
    : null;
  const prevLogin = prevSessions.length
    ? prevSessions.reduce((sum, s) => sum + (Number(s.logged_in_seconds) || 0), 0)
    : null;

  const currentJobs = new Set<string>();
  for (const a of activities) if (a.job_id) currentJobs.add(a.job_id);
  for (const l of logs) if (l.job_id) currentJobs.add(l.job_id);
  const prevJobs = new Set<string>();
  for (const a of prevActivities) if (a.job_id) prevJobs.add(a.job_id);
  for (const l of prevLogs) if (l.job_id) prevJobs.add(l.job_id);

  const currentActivityCount = activities.length + logs.length;
  const previousActivityCount = prevActivities.length + prevLogs.length;
  const hasActivityData = currentActivityCount > 0 || previousActivityCount > 0;

  const interviewsScheduled = logs.filter((l) =>
    /interview/i.test(l.activity_type) || /interview/i.test(l.action_label ?? ""),
  ).length;
  const hires = [...activities, ...logs.map((l) => ({ event_type: l.activity_type }))].filter((a) =>
    /hire/i.test("event_type" in a ? a.event_type : ""),
  ).length;

  const avgEngaged =
    hasSessionData && employeesWithActivity > 0
      ? hoursFromSeconds(totalEngagedSeconds / employeesWithActivity)
      : hasSessionData
        ? hoursFromSeconds(totalEngagedSeconds / Math.max(totalEmployees, 1))
        : null;

  const engagement = engagementRatio(
    hasSessionData ? totalEngagedSeconds / 60 : null,
    hasSessionData ? totalLoginSeconds / 60 : null,
  );

  const overviewCards: MetricCard[] = [
    cardFromChange(
      "total_employees",
      "Total employees",
      totalEmployees,
      null,
      "Staff members in scope for the selected filters",
    ),
    cardFromChange(
      "employees_with_activity",
      "Employees with recorded activity",
      hasActivityData || hasSessionData ? employeesWithActivity : null,
      null,
      "Employees with at least one activity event or session in the period",
    ),
    cardFromChange(
      "active_users_now",
      "Active users right now",
      activeNow,
      null,
      "Sessions with a recent heartbeat that have not timed out",
    ),
    cardFromChange(
      "session_hours",
      "Total recorded session hours",
      hasSessionData ? hoursFromSeconds(totalLoginSeconds) : null,
      hoursFromSeconds(prevLogin),
      "Sum of logged-in duration for sessions started in the period",
      "hours",
    ),
    cardFromChange(
      "engaged_hours",
      "Total engaged session hours",
      hasSessionData ? hoursFromSeconds(totalEngagedSeconds) : null,
      hoursFromSeconds(prevEngaged),
      "Time with recent meaningful application interaction (idle excluded)",
      "hours",
    ),
    cardFromChange(
      "avg_engaged_hours",
      "Avg engaged hours / employee",
      avgEngaged,
      null,
      "Total engaged hours divided by employees with activity when available",
      "hours",
    ),
    cardFromChange(
      "jobs_worked",
      "Total jobs worked on",
      currentJobs.size > 0 || hasActivityData ? currentJobs.size : null,
      prevJobs.size > 0 ? prevJobs.size : null,
      "Distinct jobs with at least one attributed qualifying activity",
    ),
    cardFromChange(
      "activities_completed",
      "Total activities completed",
      hasActivityData ? currentActivityCount : null,
      hasActivityData || previousActivityCount > 0 ? previousActivityCount : null,
      "Count of analytics activity events + recruiter activity logs in period",
    ),
    cardFromChange(
      "tasks_completed",
      "Total tasks completed",
      null,
      null,
      "No general task store is available yet — shown as N/A",
    ),
    cardFromChange(
      "tasks_pending",
      "Total pending tasks",
      null,
      null,
      "No general task store is available yet — shown as N/A",
    ),
    cardFromChange(
      "tasks_overdue",
      "Total overdue tasks",
      null,
      null,
      "No general task store is available yet — shown as N/A",
    ),
    {
      key: "task_completion_rate",
      label: "Overall task completion rate",
      value: null,
      display: "N/A",
      previous: null,
      changePct: null,
      direction: "na",
      availability: "missing",
      explanation: "Requires tasks-due data; not fabricated as zero",
      unit: "%",
    },
    cardFromChange(
      "avg_workload",
      "Average workload / employee",
      totalEmployees > 0 && currentJobs.size > 0
        ? Math.round((currentJobs.size / totalEmployees) * 100) / 100
        : null,
      null,
      "Distinct jobs worked / employees in scope",
    ),
    {
      key: "engagement_ratio",
      label: "Engagement ratio",
      value: engagement.value,
      display: formatMetricDisplay(engagement.value, engagement.availability),
      previous: null,
      changePct: null,
      direction: "na",
      availability: engagement.availability,
      explanation: engagement.explanation,
      unit: "%",
    },
    cardFromChange(
      "recruiting_hires",
      "Recruiting hires",
      hires > 0 ? hires : null,
      null,
      "Hire-attributed events when present in activity data",
    ),
    {
      key: "kpi_target_attainment",
      label: "KPI target attainment",
      value: null,
      display: "N/A",
      previous: null,
      changePct: null,
      direction: "na",
      availability: "missing",
      explanation: "Configurable scorecard targets not yet assigned for this period",
      unit: "%",
    },
  ];

  const departmentBarsSource = new Map<string, { name: string; activities: number }>();
  for (const dept of departments) {
    departmentBarsSource.set(dept.id, { name: dept.name, activities: 0 });
  }
  departmentBarsSource.set("__none__", { name: "Unassigned", activities: 0 });

  for (const emp of employees) {
    const key = emp.departmentId ?? "__none__";
    const entry = departmentBarsSource.get(key) ?? {
      name: emp.departmentName ?? "Unassigned",
      activities: 0,
    };
    entry.activities += emp.activityCount ?? 0;
    departmentBarsSource.set(key, entry);
  }

  const departmentSummaries: DepartmentSummary[] = [...departmentBarsSource.entries()].map(
    ([id, entry]) => {
      const deptEmployees = employees.filter((e) => (e.departmentId ?? "__none__") === id);
      const engaged = deptEmployees.reduce((sum, e) => sum + (e.engagedHours ?? 0), 0);
      const hasEngaged = deptEmployees.some((e) => e.engagedHours != null);
      const acts = deptEmployees.reduce((sum, e) => sum + (e.activityCount ?? 0), 0);
      const hasActs = deptEmployees.some((e) => e.activityCount != null);
      const jobs = deptEmployees.reduce((sum, e) => sum + (e.jobsWorked ?? 0), 0);
      const hasJobs = deptEmployees.some((e) => e.jobsWorked != null);
      return {
        departmentId: id === "__none__" ? null : id,
        name: entry.name,
        employeeCount: deptEmployees.length,
        activeEmployees: deptEmployees.filter((e) => (e.activityCount ?? 0) > 0).length,
        engagedHours: hasEngaged ? Math.round(engaged * 100) / 100 : null,
        activityCount: hasActs ? acts : null,
        jobsWorked: hasJobs ? jobs : null,
      };
    },
  );

  const nameById = new Map(visibleStaff.map((m) => [m.id, m.name]));
  const sessionHistory: SessionHistoryRow[] = sessions
    .slice()
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
    .slice(0, 100)
    .map((s) => ({
      sessionId: s.id,
      employeeId: s.user_id,
      employeeName: nameById.get(s.user_id) ?? "Unknown",
      loginAt: s.started_at,
      logoutAt: s.logout_at ?? s.ended_at,
      sessionHours: hoursFromSeconds(s.logged_in_seconds) ?? 0,
      engagedHours: hoursFromSeconds(s.engaged_seconds) ?? 0,
      idleHours: hoursFromSeconds(s.idle_seconds) ?? 0,
      activities: s.activity_count ?? 0,
      isActive: Boolean(s.is_active),
    }));

  const activityTimestamps = [
    ...activities.map((a) => a.occurred_at),
    ...logs.map((l) => l.created_at),
  ];
  const lastActivityAt =
    activityTimestamps.sort().at(-1) ??
    sessions.map((s) => s.started_at).sort().at(-1) ??
    null;
  const lastHeartbeat =
    activeSessions.map((s) => s.last_heartbeat_at).sort().at(-1) ?? null;

  const disclosure =
    String(settingsRow.data?.engagement_disclosure ?? "").trim() ||
    "Engaged session time measures interaction with this application, not all work performed by the employee.";

  const meaningfulActions = activities.filter((a) => meaningfulSet.has(a.event_type)).length + logs.length;

  return {
    generatedAt: new Date().toISOString(),
    dataFreshness: {
      lastActivityAt,
      lastSessionHeartbeatAt: lastHeartbeat,
      note: "Historical analytics come from persisted events. Active sessions require heartbeats.",
    },
    disclosure,
    period: {
      preset: period.preset,
      label: period.label,
      start: startIso,
      end: endIso,
      previousStart: prevStartIso,
      previousEnd: prevEndIso,
    },
    filtersApplied: filters,
    tabs: [
      { id: "overview", label: "Overview", available: true },
      { id: "departments", label: "Departments", available: true },
      { id: "employees", label: "Employee Performance", available: true },
      { id: "sessions", label: "Activity & Sessions", available: true },
      { id: "jobs", label: "Job & Task Analytics", available: true },
      { id: "recruitment", label: "Recruitment Analytics", available: true },
      { id: "hr", label: "HR Analytics", available: false },
      { id: "finance", label: "Finance Analytics", available: false },
      { id: "scorecards", label: "KPI Scorecards", available: false },
      { id: "exports", label: "Reports & Exports", available: true },
      { id: "settings", label: "KPI Settings", available: true },
    ],
    overview: {
      cards: overviewCards,
      activityTrend: buildDailyTrend(activityTimestamps, period.start, period.end),
      engagedTrend: buildDailyTrend(
        sessions.map((s) => s.started_at),
        period.start,
        period.end,
      ).map((p) => ({ ...p, value: p.value > 0 ? p.value : null })),
      departmentBars: departmentSummaries.map((d) => ({
        dept: d.name,
        value: d.activityCount,
        available: d.activityCount != null,
      })),
    },
    departments: departmentSummaries,
    employees,
    sessions: {
      activeCount: activeNow,
      history: sessionHistory,
    },
    recruitment: {
      available: true,
      note: "Recruitment metrics use recruiter_activity_logs and analytics_activity_events with actor attribution.",
      totals: {
        meaningfulActions: meaningfulActions > 0 ? meaningfulActions : null,
        distinctJobsWorked: currentJobs.size > 0 ? currentJobs.size : null,
        interviewsScheduled: interviewsScheduled > 0 ? interviewsScheduled : null,
        hiresAttributed: hires > 0 ? hires : null,
      },
    },
    hr: {
      available: false,
      note: "HR case/request tables are not yet instrumented. Metrics will appear as N/A until HR events are recorded.",
    },
    finance: {
      available: false,
      note: "Finance processing events are not yet instrumented. Raw transaction amounts are never used as productivity scores.",
    },
    scorecards: {
      available: false,
      note: "Configurable scorecard versions can be defined in KPI Settings; weighted scores stay N/A until items are configured.",
    },
  };
}

export async function buildEmployeeDetailPayload(
  supabase: SupabaseClient,
  tenantId: string,
  employeeId: string,
  filters: TeamProductivityFilters,
): Promise<{
  employee: EmployeePerformanceRow | null;
  timeline: ActivityTimelineItem[];
  jobsWorked: Array<{ jobId: string; activityCount: number }>;
  sessions: SessionHistoryRow[];
  period: TeamProductivityPayload["period"];
  disclosure: string;
  kpiExplanations: Array<{ key: string; explanation: string; value: string }>;
}> {
  const payload = await buildTeamProductivityPayload(supabase, tenantId, {
    ...filters,
    employeeIds: [employeeId],
  });
  const employee = payload.employees.find((e) => e.employeeId === employeeId) ?? null;

  const startIso = payload.period.start;
  const endIso = payload.period.end;

  const [{ data: acts }, { data: logs }, { data: sessions }] = await Promise.all([
    supabase
      .from("analytics_activity_events")
      .select(
        "id, event_type, module, entity_type, entity_id, job_id, occurred_at, actor_user_id, attribution_type, source, metadata",
      )
      .eq("tenant_id", tenantId)
      .eq("actor_user_id", employeeId)
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("recruiter_activity_logs")
      .select("id, activity_type, action_label, job_id, candidate_id, created_at, recruiter_user_id, source")
      .eq("tenant_id", tenantId)
      .eq("recruiter_user_id", employeeId)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false })
      .limit(200),
    Promise.resolve({ data: payload.sessions.history.filter((s) => s.employeeId === employeeId) }),
  ]);

  const timeline: ActivityTimelineItem[] = [
    ...((acts ?? []) as Array<{
      id: string;
      event_type: string;
      module: string;
      entity_type: string | null;
      entity_id: string | null;
      job_id: string | null;
      occurred_at: string;
      actor_user_id: string | null;
      attribution_type: string;
      source: string;
    }>).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      eventType: row.event_type,
      module: row.module,
      entityType: row.entity_type,
      entityId: row.entity_id,
      jobId: row.job_id,
      actorUserId: row.actor_user_id,
      attributionType: row.attribution_type,
      source: row.source,
      description: row.event_type.replace(/_/g, " "),
    })),
    ...((logs ?? []) as Array<{
      id: string;
      activity_type: string;
      action_label: string;
      job_id: string | null;
      candidate_id: string | null;
      created_at: string;
      recruiter_user_id: string | null;
      source: string;
    }>).map((row) => ({
      id: row.id,
      occurredAt: row.created_at,
      eventType: row.activity_type,
      module: "recruiting",
      entityType: row.candidate_id ? "candidate" : null,
      entityId: row.candidate_id,
      jobId: row.job_id,
      actorUserId: row.recruiter_user_id,
      attributionType: "actor",
      source: row.source,
      description: row.action_label || row.activity_type.replace(/_/g, " "),
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const jobsMap = new Map<string, number>();
  for (const item of timeline) {
    if (!item.jobId) continue;
    jobsMap.set(item.jobId, (jobsMap.get(item.jobId) ?? 0) + 1);
  }

  return {
    employee,
    timeline,
    jobsWorked: [...jobsMap.entries()].map(([jobId, activityCount]) => ({ jobId, activityCount })),
    sessions: sessions ?? [],
    period: payload.period,
    disclosure: payload.disclosure,
    kpiExplanations: [
      {
        key: "engaged_hours",
        explanation:
          "Sum of engaged session seconds / 3600. Idle time exceeding the configured threshold is excluded.",
        value: employee?.engagedHours != null ? String(employee.engagedHours) : "N/A",
      },
      {
        key: "jobs_worked",
        explanation:
          "Count of distinct job_ids with at least one attributed qualifying activity for this employee.",
        value: employee?.jobsWorked != null ? String(employee.jobsWorked) : "N/A",
      },
      {
        key: "activity_count",
        explanation: "analytics_activity_events + recruiter_activity_logs attributed to this actor.",
        value: employee?.activityCount != null ? String(employee.activityCount) : "N/A",
      },
    ],
  };
}

export function employeesToCsv(rows: EmployeePerformanceRow[]): string {
  const headers = [
    "Employee",
    "Email",
    "Department",
    "Role",
    "Engaged Hours",
    "Login Hours",
    "Idle Hours",
    "Jobs Worked",
    "Activity Count",
    "Target Attainment",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = [
      row.name,
      row.email,
      row.departmentName ?? "",
      row.roleLabel,
      row.engagedHours ?? "N/A",
      row.loginHours ?? "N/A",
      row.idleHours ?? "N/A",
      row.jobsWorked ?? "N/A",
      row.activityCount ?? "N/A",
      row.targetAttainment ?? "N/A",
    ].map((cell) => {
      const s = String(cell);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
