import type { SupabaseClient } from "@supabase/supabase-js";
import { PRE_HIRE_FIGMA_STAGES } from "@/lib/onboarding/hire-stage-catalog";

export type StageAdvanceBreakdown = {
  stageName: string;
  count: number;
};

export type RecruiterProductivityKpis = {
  statusUpdates: number;
  stageAdvances: number;
  stageAdvancesByStage: StageAdvanceBreakdown[];
  candidateMatches: number;
};

export type RecruiterProductivityKpiMaps = {
  byUser: Map<string, RecruiterProductivityKpis>;
  totals: RecruiterProductivityKpis;
};

type StatusMeta = {
  stageName: string | null;
  stageRank: number | null;
  withinStageSort: number | null;
  statusSort: number;
  closed: boolean;
};

type HistoryRow = {
  changed_by_user_id: string | null;
  change_source: string | null;
  from_status_id: string | null;
  to_status_id: string | null;
  application_id: string;
  created_at: string;
};

type MatchRow = {
  ai_analyzed_by: string | null;
  job_requisition_id: string | null;
};

const STAGE_RANK = new Map(
  PRE_HIRE_FIGMA_STAGES.map((name, index) => [name.toLowerCase(), index]),
);

function emptyKpis(): RecruiterProductivityKpis {
  return {
    statusUpdates: 0,
    stageAdvances: 0,
    stageAdvancesByStage: [],
    candidateMatches: 0,
  };
}

function ensureUser(
  map: Map<string, RecruiterProductivityKpis>,
  userId: string,
): RecruiterProductivityKpis {
  const existing = map.get(userId);
  if (existing) return existing;
  const created = emptyKpis();
  map.set(userId, created);
  return created;
}

function stageRankForName(stageName: string | null | undefined): number | null {
  if (!stageName) return null;
  const rank = STAGE_RANK.get(stageName.trim().toLowerCase());
  return rank == null ? null : rank;
}

function isClosedLane(lane: string | null | undefined): boolean {
  return String(lane ?? "")
    .trim()
    .toLowerCase() === "closed";
}

function isClosedStatusName(name: string | null | undefined): boolean {
  return /closed|reject|withdraw|decline|not.?selected|disqualif/i.test(String(name ?? ""));
}

function missingRelation(message: string | undefined): boolean {
  return Boolean(
    message && /(does not exist|Could not find the table|schema cache)/i.test(message),
  );
}

async function loadStatusMeta(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Map<string, StatusMeta>> {
  const [statusesRes, assignmentsRes, lanesRes] = await Promise.all([
    supabase
      .from("application_statuses")
      .select("id, name, sort_order, system_key, button_lane")
      .eq("tenant_id", tenantId)
      .limit(5000),
    supabase
      .from("application_status_stage_assignments")
      .select("status_id, stage_name, sort_order")
      .eq("tenant_id", tenantId)
      .limit(5000),
    supabase
      .from("application_status_stage_lanes")
      .select("status_id, stage_name, lane")
      .eq("tenant_id", tenantId)
      .limit(5000),
  ]);

  if (statusesRes.error && !missingRelation(statusesRes.error.message)) {
    throw statusesRes.error;
  }
  if (assignmentsRes.error && !missingRelation(assignmentsRes.error.message)) {
    throw assignmentsRes.error;
  }
  if (lanesRes.error && !missingRelation(lanesRes.error.message)) {
    throw lanesRes.error;
  }

  const statuses = (statusesRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    sort_order: number | null;
    system_key: string | null;
    button_lane: string | null;
  }>;
  const assignments = (assignmentsRes.data ?? []) as Array<{
    status_id: string;
    stage_name: string;
    sort_order: number | null;
  }>;
  const lanes = (lanesRes.data ?? []) as Array<{
    status_id: string;
    stage_name: string;
    lane: string | null;
  }>;

  const bestAssignment = new Map<
    string,
    { stageName: string; stageRank: number; withinStageSort: number }
  >();
  for (const row of assignments) {
    const rank = stageRankForName(row.stage_name);
    if (rank == null) continue;
    const within = Number(row.sort_order) || 0;
    const existing = bestAssignment.get(row.status_id);
    if (
      !existing ||
      rank < existing.stageRank ||
      (rank === existing.stageRank && within < existing.withinStageSort)
    ) {
      bestAssignment.set(row.status_id, {
        stageName: row.stage_name,
        stageRank: rank,
        withinStageSort: within,
      });
    }
  }

  const closedByStatus = new Set<string>();
  for (const row of lanes) {
    if (isClosedLane(row.lane)) closedByStatus.add(row.status_id);
  }

  const meta = new Map<string, StatusMeta>();
  for (const status of statuses) {
    const assigned = bestAssignment.get(status.id);
    const closed =
      closedByStatus.has(status.id) ||
      isClosedLane(status.button_lane) ||
      String(status.system_key ?? "").toLowerCase() === "closed" ||
      isClosedStatusName(status.name);
    meta.set(status.id, {
      stageName: assigned?.stageName ?? null,
      stageRank: assigned?.stageRank ?? null,
      withinStageSort: assigned?.withinStageSort ?? null,
      statusSort: Number(status.sort_order) || 0,
      closed,
    });
  }
  return meta;
}

function isForwardMove(
  from: StatusMeta | undefined,
  to: StatusMeta | undefined,
): { forward: boolean; toStageName: string | null } {
  if (!to || to.closed) {
    return { forward: false, toStageName: to?.stageName ?? null };
  }
  if (!from) {
    // Initial attributed moves into a known stage still count as forward when destination is not closed.
    return {
      forward: to.stageRank != null || to.statusSort > 0,
      toStageName: to.stageName,
    };
  }
  if (from.closed) {
    return { forward: false, toStageName: to.stageName };
  }

  if (from.stageRank != null && to.stageRank != null) {
    if (to.stageRank > from.stageRank) {
      return { forward: true, toStageName: to.stageName };
    }
    if (
      to.stageRank === from.stageRank &&
      from.withinStageSort != null &&
      to.withinStageSort != null &&
      to.withinStageSort > from.withinStageSort
    ) {
      return { forward: true, toStageName: to.stageName };
    }
    return { forward: false, toStageName: to.stageName };
  }

  if (to.statusSort > from.statusSort) {
    return { forward: true, toStageName: to.stageName };
  }
  return { forward: false, toStageName: to.stageName };
}

function finalizeStageBreakdown(
  counts: Map<string, number>,
): StageAdvanceBreakdown[] {
  return [...counts.entries()]
    .map(([stageName, count]) => ({ stageName, count }))
    .sort((a, b) => {
      const aRank = stageRankForName(a.stageName) ?? Number.MAX_SAFE_INTEGER;
      const bRank = stageRankForName(b.stageName) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return b.count - a.count;
    });
}

function aggregateHistory(
  rows: HistoryRow[],
  statusMeta: Map<string, StatusMeta>,
  options: {
    staffIdSet: Set<string>;
    allowedApplicationIds: Set<string> | null;
  },
): RecruiterProductivityKpiMaps {
  const byUser = new Map<string, RecruiterProductivityKpis>();
  const stageTotals = new Map<string, number>();
  const stageByUser = new Map<string, Map<string, number>>();
  let statusUpdates = 0;
  let stageAdvances = 0;

  for (const row of rows) {
    const userId = row.changed_by_user_id;
    if (!userId) continue;
    if (options.staffIdSet.size > 0 && !options.staffIdSet.has(userId)) continue;
    if (
      options.allowedApplicationIds &&
      !options.allowedApplicationIds.has(row.application_id)
    ) {
      continue;
    }

    const source = String(row.change_source ?? "USER").toUpperCase();
    // Count recruiter-attributed updates; skip pure SYSTEM noise without an actor (already filtered).
    if (source === "SYSTEM" && !row.changed_by_user_id) continue;

    const user = ensureUser(byUser, userId);
    user.statusUpdates += 1;
    statusUpdates += 1;

    const from = row.from_status_id ? statusMeta.get(row.from_status_id) : undefined;
    const to = row.to_status_id ? statusMeta.get(row.to_status_id) : undefined;
    const move = isForwardMove(from, to);
    if (!move.forward) continue;

    user.stageAdvances += 1;
    stageAdvances += 1;

    const stageName = move.toStageName?.trim() || "Unmapped stage";
    stageTotals.set(stageName, (stageTotals.get(stageName) ?? 0) + 1);
    const userStages = stageByUser.get(userId) ?? new Map<string, number>();
    userStages.set(stageName, (userStages.get(stageName) ?? 0) + 1);
    stageByUser.set(userId, userStages);
  }

  for (const [userId, stages] of stageByUser) {
    const user = ensureUser(byUser, userId);
    user.stageAdvancesByStage = finalizeStageBreakdown(stages);
  }

  return {
    byUser,
    totals: {
      statusUpdates,
      stageAdvances,
      stageAdvancesByStage: finalizeStageBreakdown(stageTotals),
      candidateMatches: 0,
    },
  };
}

function mergeMatchCounts(
  maps: RecruiterProductivityKpiMaps,
  matches: MatchRow[],
  staffIdSet: Set<string>,
  jobId: string | null | undefined,
): RecruiterProductivityKpiMaps {
  let total = 0;
  for (const row of matches) {
    const userId = row.ai_analyzed_by;
    if (!userId) continue;
    if (staffIdSet.size > 0 && !staffIdSet.has(userId)) continue;
    if (jobId && row.job_requisition_id !== jobId) continue;
    const user = ensureUser(maps.byUser, userId);
    user.candidateMatches += 1;
    total += 1;
  }
  maps.totals.candidateMatches = total;
  return maps;
}

/**
 * Recruiter pipeline KPIs sourced from:
 * - application_status_history (status updates + stage advances)
 * - application_status_stage_assignments / lanes (stage ranking)
 * - job_applications.ai_analyzed_by / ai_analyzed_at (candidate match)
 */
export async function loadRecruiterProductivityKpis(
  supabase: SupabaseClient,
  tenantId: string,
  options: {
    startIso: string;
    endIso: string;
    staffIds: string[];
    jobId?: string | null;
  },
): Promise<RecruiterProductivityKpiMaps> {
  const staffIdSet = new Set(options.staffIds);
  const statusMeta = await loadStatusMeta(supabase, tenantId);

  let historyQuery = supabase
    .from("application_status_history")
    .select(
      "changed_by_user_id, change_source, from_status_id, to_status_id, application_id, created_at",
    )
    .eq("tenant_id", tenantId)
    .not("changed_by_user_id", "is", null)
    .gte("created_at", options.startIso)
    .lte("created_at", options.endIso)
    .order("created_at", { ascending: false })
    .limit(8000);

  if (staffIdSet.size > 0 && staffIdSet.size <= 100) {
    historyQuery = historyQuery.in("changed_by_user_id", [...staffIdSet]);
  }

  const matchQuery = supabase
    .from("job_applications")
    .select("ai_analyzed_by, job_requisition_id")
    .eq("tenant_id", tenantId)
    .eq("ai_match_status", "ANALYZED")
    .not("ai_analyzed_by", "is", null)
    .gte("ai_analyzed_at", options.startIso)
    .lte("ai_analyzed_at", options.endIso)
    .limit(8000);

  const [historyRes, matchRes, jobAppsRes] = await Promise.all([
    historyQuery,
    options.jobId
      ? matchQuery.eq("job_requisition_id", options.jobId)
      : matchQuery,
    options.jobId
      ? supabase
          .from("job_applications")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("job_requisition_id", options.jobId)
          .limit(8000)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (historyRes.error && !missingRelation(historyRes.error.message)) {
    throw historyRes.error;
  }
  if (matchRes.error && !missingRelation(matchRes.error.message)) {
    throw matchRes.error;
  }
  if (jobAppsRes.error && !missingRelation(jobAppsRes.error.message)) {
    throw jobAppsRes.error;
  }

  const allowedApplicationIds = options.jobId
    ? new Set(
        ((jobAppsRes.data ?? []) as Array<{ id: string }>).map((row) => row.id),
      )
    : null;

  const maps = aggregateHistory(
    (missingRelation(historyRes.error?.message) ? [] : historyRes.data ?? []) as HistoryRow[],
    statusMeta,
    { staffIdSet, allowedApplicationIds },
  );

  return mergeMatchCounts(
    maps,
    (missingRelation(matchRes.error?.message) ? [] : matchRes.data ?? []) as MatchRow[],
    staffIdSet,
    options.jobId,
  );
}

export function kpisForUser(
  maps: RecruiterProductivityKpiMaps,
  userId: string,
): RecruiterProductivityKpis {
  return maps.byUser.get(userId) ?? emptyKpis();
}

export function nullableCount(value: number): number | null {
  return value > 0 ? value : null;
}
