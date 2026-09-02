import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { formatCandidateLocation } from "@/lib/admin/candidate-profile-view";
import {
  IMPORT_MATCH_FETCH_CAP,
  IMPORT_NOTES_EXCERPT_CHARS,
  IMPORT_RECOMMENDED_MIN_SCORE,
  IMPORT_RESUME_EXCERPT_CHARS,
  buildImportResultMessage,
  candidateHaystack,
  experienceBucketMatch,
  isImportCandidateUuid,
  jobProfileFromWorkspace,
  normalizeImportCandidateIds,
  phrasePresent,
  scoreCandidateAgainstJob,
  skillsPresentInHaystack,
  tagsPresentInHaystack,
  toCandidateSearchPattern,
  type ImportCandidateView,
  type ImportSearchParams,
  type JobMatchProfile,
} from "@/lib/jobs/candidate-import-match";
import {
  attachWorkflowInstanceToApplication,
  resolvePublishedFlowForJobWorkflow,
} from "@/lib/jobs/service";
import { JobValidationError } from "@/lib/jobs/types";
import { normalizeApplicantEmail } from "@/lib/jobs/validation";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import {
  ACTIVE_CANDIDATE_PIPELINE_STATUSES,
  formatPipelineStatusLabel,
} from "@/lib/workers/candidate-status-label";

type DbClient = SupabaseClient;

const INACTIVE_APPLICATION_STATUSES = '("rejected","withdrawn")';

export class CandidateImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "BAD_REQUEST"
      | "EMPTY"
      | "TOO_MANY"
      | "INVALID_ID"
      | "JOB_NOT_PUBLISHED"
      | "JOB_UNAVAILABLE",
    public readonly status: number
  ) {
    super(message);
    this.name = "CandidateImportError";
  }
}

export type ImportSearchResult = {
  candidates: ImportCandidateView[];
  total: number;
  allTotal: number;
  recommendedTotal: number;
  page: number;
  pageSize: number;
  truncated: boolean;
  job: { id: string; title: string; jobRef: string };
  suggestedTags: string[];
  suggestedSkills: string[];
  suggestedRoles: string[];
  facets: {
    locations: string[];
    roles: string[];
    statuses: Array<{ id: string; name: string; color: string | null }>;
  };
};

export type ImportMutationResult = {
  imported: string[];
  skippedAlreadyAdded: string[];
  skippedNotFound: string[];
  importedCount: number;
  skippedCount: number;
  skippedNotFoundCount: number;
  jobTitle: string;
  jobRef: string;
  message: string;
};

type JobImportRow = {
  id: string;
  tenant_id: string;
  public_title: string | null;
  source_job_title: string | null;
  internal_requisition_number: string | null;
  public_description: string | null;
  qualifications: string | null;
  responsibilities: string | null;
  special_requirements: string | null;
  required_credentials: unknown;
  years_of_experience: string | null;
  years_experience_required: number | null;
  location: string | null;
  specialty: string | null;
  department: string | null;
  facility: string | null;
  facility_name: string | null;
  structured_requirements: unknown;
  status: string | null;
  workflow_id: string | null;
  professions: { name?: string | null } | { name?: string | null }[] | null;
  specialties: { name?: string | null } | { name?: string | null }[] | null;
};

type WorkerImportRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_role: string | null;
  city: string | null;
  state: string | null;
  address1: string | null;
  address2: string | null;
  zip: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function oneName(
  value: { name?: string | null } | { name?: string | null }[] | null | undefined
): string {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] : value;
  return asText(row?.name);
}

function jobRefOf(job: Pick<JobImportRow, "id" | "internal_requisition_number">): string {
  return asText(job.internal_requisition_number) || job.id.slice(0, 8).toUpperCase();
}

function workerFullName(row: Pick<WorkerImportRow, "first_name" | "last_name">): string {
  return [row.first_name, row.last_name].map(asText).filter(Boolean).join(" ") || "Unnamed candidate";
}

function workerLocation(row: Pick<WorkerImportRow, "address1" | "address2" | "city" | "state" | "zip">): string {
  return formatCandidateLocation({
    address1: row.address1,
    address2: row.address2,
    city: row.city,
    state: row.state,
    zip: row.zip,
  });
}

function pipelineStatusColor(status: string | null | undefined): string | null {
  const key = asText(status).toLowerCase().replace(/\s+/g, "_");
  if (key === "pending" || key === "under_review") return "#F59E0B";
  if (key === "for_approval") return "#F97316";
  if (key === "approved") return "#22C55E";
  if (key === "disapproved" || key === "rejected") return "#EF4444";
  if (key === "converted") return "#6B7280";
  if (key === "new") return "#BC8B41";
  return "#64748B";
}

function ilikeOr(columns: string[], pattern: string): string {
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}

function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "23505") return true;
  return typeof err.message === "string" && /duplicate key|unique constraint/i.test(err.message);
}

async function loadJobForImport(
  supabase: DbClient,
  tenantId: string,
  jobId: string
): Promise<JobImportRow> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select(
      "id, tenant_id, public_title, source_job_title, internal_requisition_number, public_description, qualifications, responsibilities, special_requirements, required_credentials, years_of_experience, years_experience_required, location, specialty, department, facility, facility_name, structured_requirements, status, workflow_id, professions(name), specialties(name)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new CandidateImportError("Job not found", "NOT_FOUND", 404);
  }
  return data as JobImportRow;
}

async function collectIdsFromQuery(
  run: () => PromiseLike<{ data: Array<{ worker_id?: string | null; id?: string | null }> | null; error: { message: string } | null }>
): Promise<string[]> {
  const { data, error } = await run();
  if (error) throw error;
  const ids: string[] = [];
  for (const row of data ?? []) {
    const id = asText(row.worker_id ?? row.id);
    if (id) ids.push(id);
  }
  return ids;
}

async function workerIdsMatchingIlike(
  supabase: DbClient,
  tenantId: string,
  pattern: string
): Promise<string[]> {
  const [workers, resumes, notes, verified] = await Promise.all([
    collectIdsFromQuery(() =>
      supabase
        .from("worker")
        .select("id")
        .eq("tenant_id", tenantId)
        .or(
          ilikeOr(
            ["first_name", "last_name", "job_role", "city", "state", "address1", "email"],
            pattern
          )
        )
        .limit(IMPORT_MATCH_FETCH_CAP)
    ),
    collectIdsFromQuery(() =>
      supabase
        .from("worker_resumes")
        .select("worker_id")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .ilike("extracted_text", pattern)
        .limit(IMPORT_MATCH_FETCH_CAP)
    ),
    collectIdsFromQuery(() =>
      supabase
        .from("worker_notes")
        .select("worker_id")
        .eq("tenant_id", tenantId)
        .ilike("body", pattern)
        .limit(IMPORT_MATCH_FETCH_CAP)
    ),
    collectIdsFromQuery(async () => {
      const { data, error } = await supabase
        .from("job_application_verified_information")
        .select("application_id")
        .eq("tenant_id", tenantId)
        .or(ilikeOr(["title", "details"], pattern))
        .limit(IMPORT_MATCH_FETCH_CAP);
      if (error || !data?.length) return { data: [], error };
      const applicationIds = data.map((row) => asText(row.application_id)).filter(Boolean);
      const { data: apps, error: appsError } = await supabase
        .from("job_applications")
        .select("worker_id")
        .eq("tenant_id", tenantId)
        .in("id", applicationIds);
      return { data: apps ?? [], error: appsError };
    }),
  ]);

  const statusKey = pattern.replace(/%/g, "").trim().toLowerCase().replace(/\s+/g, "_");
  const statusHits = ACTIVE_CANDIDATE_PIPELINE_STATUSES.filter(
    (status) =>
      status.includes(statusKey) ||
      formatPipelineStatusLabel(status).toLowerCase().includes(statusKey)
  );
  let statusIds: string[] = [];
  if (statusHits.length) {
    statusIds = await collectIdsFromQuery(() =>
      supabase
        .from("worker")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("status", statusHits)
        .limit(IMPORT_MATCH_FETCH_CAP)
    );
  }

  const previousTitleIds = await workerIdsMatchingPreviousTitle(supabase, tenantId, pattern);
  return [...workers, ...resumes, ...notes, ...verified, ...statusIds, ...previousTitleIds];
}

async function workerIdsMatchingPreviousTitle(
  supabase: DbClient,
  tenantId: string,
  pattern: string,
  excludeJobId?: string
): Promise<string[]> {
  const { data: jobs, error: jobsError } = await supabase
    .from("job_requisitions")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("public_title", pattern)
    .limit(80);
  if (jobsError) throw jobsError;
  const jobIds = (jobs ?? [])
    .map((row) => asText(row.id))
    .filter((id) => id && id !== excludeJobId);
  if (!jobIds.length) return [];

  const { data: apps, error: appsError } = await supabase
    .from("job_applications")
    .select("worker_id")
    .eq("tenant_id", tenantId)
    .in("job_requisition_id", jobIds)
    .not("status", "in", INACTIVE_APPLICATION_STATUSES)
    .limit(IMPORT_MATCH_FETCH_CAP);
  if (appsError) throw appsError;
  return (apps ?? []).map((row) => asText(row.worker_id)).filter(Boolean);
}

async function workerIdsMatchingPhraseColumns(
  supabase: DbClient,
  tenantId: string,
  phrases: string[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const phrase of phrases.slice(0, 8)) {
    const pattern = toCandidateSearchPattern(phrase);
    if (!pattern) continue;
    const [workers, resumes] = await Promise.all([
      collectIdsFromQuery(() =>
        supabase
          .from("worker")
          .select("id")
          .eq("tenant_id", tenantId)
          .or(ilikeOr(["job_role", "first_name", "last_name", "city", "state"], pattern))
          .limit(IMPORT_MATCH_FETCH_CAP)
      ),
      collectIdsFromQuery(() =>
        supabase
          .from("worker_resumes")
          .select("worker_id")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .ilike("extracted_text", pattern)
          .limit(IMPORT_MATCH_FETCH_CAP)
      ),
    ]);
    ids.push(...workers, ...resumes);
  }
  return ids;
}

function intersectOrPass(current: string[] | null, next: string[] | null): string[] | null {
  if (next == null) return current;
  if (current == null) return Array.from(new Set(next));
  const allow = new Set(next);
  return current.filter((id) => allow.has(id));
}

async function resolveSqlWorkerIds(
  supabase: DbClient,
  input: {
    tenantId: string;
    jobId: string;
    job: JobMatchProfile;
    params: ImportSearchParams;
  }
): Promise<string[] | null> {
  const { tenantId, jobId, job, params } = input;
  let ids: string[] | null = null;

  const skipRecommendedKeywords = Boolean(params.q) || params.skills.length > 0;
  if (params.tab === "recommended" && !skipRecommendedKeywords) {
    const keywords = uniqueLimited(
      [job.title, job.specialty, job.location, ...job.tags, ...job.keywords],
      10
    );
    const keywordIds = await workerIdsMatchingPhraseColumns(supabase, tenantId, keywords);
    ids = intersectOrPass(ids, keywordIds);
  }

  if (params.q) {
    const pattern = toCandidateSearchPattern(params.q);
    if (pattern) {
      ids = intersectOrPass(ids, await workerIdsMatchingIlike(supabase, tenantId, pattern));
    }
  }

  if (params.skills.length) {
    ids = intersectOrPass(ids, await workerIdsMatchingPhraseColumns(supabase, tenantId, params.skills));
  }

  if (params.tags.length) {
    ids = intersectOrPass(ids, await workerIdsMatchingPhraseColumns(supabase, tenantId, params.tags));
  }

  if (params.role) {
    const pattern = toCandidateSearchPattern(params.role);
    if (pattern) {
      const [roleWorkers, prior] = await Promise.all([
        collectIdsFromQuery(() =>
          supabase
            .from("worker")
            .select("id")
            .eq("tenant_id", tenantId)
            .ilike("job_role", pattern)
            .limit(IMPORT_MATCH_FETCH_CAP)
        ),
        workerIdsMatchingPreviousTitle(supabase, tenantId, pattern, jobId),
      ]);
      ids = intersectOrPass(ids, [...roleWorkers, ...prior]);
    }
  }

  if (params.previousTitle) {
    const pattern = toCandidateSearchPattern(params.previousTitle);
    if (pattern) {
      ids = intersectOrPass(
        ids,
        await workerIdsMatchingPreviousTitle(supabase, tenantId, pattern, jobId)
      );
    }
  }

  return ids;
}

function uniqueLimited(values: Array<string | null | undefined>, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = asText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

async function countTenantWorkers(supabase: DbClient, tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from("worker")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

type WorkerFilterBuilder = {
  eq: (column: string, value: unknown) => WorkerFilterBuilder;
  in: (column: string, values: string[]) => WorkerFilterBuilder;
  or: (filters: string) => WorkerFilterBuilder;
  ilike: (column: string, pattern: string) => WorkerFilterBuilder;
  order: (
    column: string,
    options: { ascending: boolean; nullsFirst?: boolean }
  ) => WorkerFilterBuilder;
  limit: (count: number) => WorkerFilterBuilder;
};

function applyWorkerFilters(
  query: WorkerFilterBuilder,
  input: { tenantId: string; params: ImportSearchParams }
): WorkerFilterBuilder {
  let next = query.eq("tenant_id", input.tenantId);
  if (input.params.status) {
    const status = input.params.status.trim();
    if (!isImportCandidateUuid(status)) {
      next = next.eq("status", status);
    }
  }
  const locationPattern = toCandidateSearchPattern(input.params.location);
  if (locationPattern) {
    next = next.or(ilikeOr(["city", "state", "address1", "zip"], locationPattern));
  }
  return next;
}

function sortWorkersForScoring(rows: WorkerImportRow[], specialty: string): WorkerImportRow[] {
  const needle = specialty.trim().toLowerCase();
  return [...rows].sort((a, b) => {
    if (needle) {
      const aHit = asText(a.job_role).toLowerCase().includes(needle) ? 0 : 1;
      const bHit = asText(b.job_role).toLowerCase().includes(needle) ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
    }
    return asText(b.updated_at || b.created_at).localeCompare(asText(a.updated_at || a.created_at));
  });
}

async function fetchWorkerPage(
  supabase: DbClient,
  input: {
    tenantId: string;
    ids: string[] | null;
    params: ImportSearchParams;
    specialty: string;
    limit: number;
  }
): Promise<{ rows: WorkerImportRow[]; sqlTotal: number }> {
  const selectCols =
    "id, first_name, last_name, email, phone, job_role, city, state, address1, address2, zip, status, updated_at, created_at";

  if (input.ids && input.ids.length === 0) {
    return { rows: [], sqlTotal: 0 };
  }

  if (input.ids) {
    const uniqueIds = Array.from(new Set(input.ids));
    const fetched = await queryInChunks(uniqueIds, async (chunk) => {
      const result = await applyWorkerFilters(
        supabase.from("worker").select(selectCols) as unknown as WorkerFilterBuilder,
        input
      ).in("id", chunk);
      const payload = result as unknown as {
        data: WorkerImportRow[] | null;
        error: unknown | null;
      };
      return { data: payload.data ?? [], error: payload.error };
    });
    if (fetched.error) throw fetched.error;
    const sorted = sortWorkersForScoring(fetched.data, input.specialty);
    return { rows: sorted.slice(0, input.limit), sqlTotal: uniqueIds.length };
  }

  const countResult = await applyWorkerFilters(
    supabase.from("worker").select("id", { count: "exact", head: true }) as unknown as WorkerFilterBuilder,
    input
  );
  const countPayload = countResult as unknown as {
    count: number | null;
    error: { message: string } | null;
  };
  if (countPayload.error) throw countPayload.error;

  const specialtyPattern = toCandidateSearchPattern(input.specialty);
  const rows: WorkerImportRow[] = [];
  if (specialtyPattern) {
    const result = await applyWorkerFilters(
      supabase.from("worker").select(selectCols) as unknown as WorkerFilterBuilder,
      input
    )
      .ilike("job_role", specialtyPattern)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(input.limit);
    const payload = result as unknown as {
      data: WorkerImportRow[] | null;
      error: { message: string } | null;
    };
    if (payload.error) throw payload.error;
    rows.push(...(payload.data ?? []));
  }

  if (rows.length < input.limit) {
    const result = await applyWorkerFilters(
      supabase.from("worker").select(selectCols) as unknown as WorkerFilterBuilder,
      input
    )
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(input.limit + rows.length);
    const payload = result as unknown as {
      data: WorkerImportRow[] | null;
      error: { message: string } | null;
    };
    if (payload.error) throw payload.error;
    const seen = new Set(rows.map((row) => row.id));
    for (const row of payload.data ?? []) {
      if (seen.has(row.id)) continue;
      rows.push(row);
      if (rows.length >= input.limit) break;
    }
  }

  return { rows: rows.slice(0, input.limit), sqlTotal: countPayload.count ?? 0 };
}

type ApplicationTitleRow = {
  worker_id: string | null;
  job_requisition_id: string | null;
  updated_at: string | null;
  job_requisitions:
    | { public_title: string | null }
    | { public_title: string | null }[]
    | null;
};

function jobTitleOf(value: ApplicationTitleRow["job_requisitions"]): string {
  if (!value) return "";
  const row = Array.isArray(value) ? value[0] : value;
  return asText(row?.public_title);
}

async function loadRelatedCandidateData(
  supabase: DbClient,
  tenantId: string,
  jobId: string,
  workerIds: string[]
) {
  const empty = {
    resumes: new Map<string, string>(),
    notes: new Map<string, string>(),
    titles: new Map<string, string[]>(),
    currentRoles: new Map<string, string>(),
    alreadyAdded: new Set<string>(),
    verified: new Map<string, string[]>(),
    skills: new Map<string, string[]>(),
  };
  if (!workerIds.length) return empty;

  const [resumesResult, notesResult, appsResult, alreadyResult, skillsResult] = await Promise.all([
    queryInChunks(workerIds, async (chunk) => {
      const result = await supabase
        .from("worker_resumes")
        .select("worker_id, extracted_text, uploaded_at")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false });
      return { data: result.data ?? [], error: result.error };
    }),
    queryInChunks(workerIds, async (chunk) => {
      const result = await supabase
        .from("worker_notes")
        .select("worker_id, body, updated_at")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk)
        .order("updated_at", { ascending: false });
      return { data: result.data ?? [], error: result.error };
    }),
    queryInChunks(workerIds, async (chunk) => {
      const result = await supabase
        .from("job_applications")
        .select("worker_id, job_requisition_id, updated_at, job_requisitions(public_title)")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk)
        .not("status", "in", INACTIVE_APPLICATION_STATUSES)
        .order("updated_at", { ascending: false });
      return { data: (result.data ?? []) as ApplicationTitleRow[], error: result.error };
    }),
    queryInChunks(workerIds, async (chunk) => {
      const result = await supabase
        .from("job_applications")
        .select("worker_id")
        .eq("tenant_id", tenantId)
        .eq("job_requisition_id", jobId)
        .in("worker_id", chunk)
        .not("status", "in", INACTIVE_APPLICATION_STATUSES);
      return { data: result.data ?? [], error: result.error };
    }),
    queryInChunks(workerIds, async (chunk) => {
      const result = await supabase
        .from("worker_profile_skills")
        .select("worker_id, skill_name")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk);
      return { data: result.data ?? [], error: result.error };
    }),
  ]);

  if (resumesResult.error) throw resumesResult.error;
  if (notesResult.error) throw notesResult.error;
  if (appsResult.error) throw appsResult.error;
  if (alreadyResult.error) throw alreadyResult.error;
  if (skillsResult.error) throw skillsResult.error;

  const resumes = new Map<string, string>();
  for (const row of resumesResult.data as Array<{ worker_id?: string | null; extracted_text?: string | null }>) {
    const workerId = asText(row.worker_id);
    if (!workerId || resumes.has(workerId)) continue;
    resumes.set(workerId, asText(row.extracted_text).slice(0, IMPORT_RESUME_EXCERPT_CHARS));
  }

  const notes = new Map<string, string>();
  for (const row of notesResult.data as Array<{ worker_id?: string | null; body?: string | null }>) {
    const workerId = asText(row.worker_id);
    if (!workerId) continue;
    const existing = notes.get(workerId) ?? "";
    const next = `${existing}\n${asText(row.body)}`.trim().slice(0, IMPORT_NOTES_EXCERPT_CHARS);
    notes.set(workerId, next);
  }

  const titles = new Map<string, string[]>();
  const currentRoles = new Map<string, string>();
  for (const row of appsResult.data) {
    const workerId = asText(row.worker_id);
    const title = jobTitleOf(row.job_requisitions);
    if (!workerId || !title) continue;
    if (row.job_requisition_id !== jobId && !currentRoles.has(workerId)) {
      currentRoles.set(workerId, title);
    }
    if (row.job_requisition_id === jobId) continue;
    const list = titles.get(workerId) ?? [];
    if (!list.includes(title) && list.length < 6) list.push(title);
    titles.set(workerId, list);
  }

  const alreadyAdded = new Set(
    alreadyResult.data.map((row) => asText((row as { worker_id?: string }).worker_id)).filter(Boolean)
  );

  const skills = new Map<string, string[]>();
  for (const row of skillsResult.data as Array<{ worker_id?: string | null; skill_name?: string | null }>) {
    const workerId = asText(row.worker_id);
    const skill = asText(row.skill_name);
    if (!workerId || !skill) continue;
    const list = skills.get(workerId) ?? [];
    if (!list.includes(skill)) list.push(skill);
    skills.set(workerId, list);
  }

  return { resumes, notes, titles, currentRoles, alreadyAdded, verified: new Map<string, string[]>(), skills };
}

async function loadFacets(
  supabase: DbClient,
  tenantId: string,
  job: JobMatchProfile
): Promise<ImportSearchResult["facets"] & { suggestedRoles: string[] }> {
  const [{ data: roleRows }, { data: locationRows }] = await Promise.all([
    supabase
      .from("worker")
      .select("job_role")
      .eq("tenant_id", tenantId)
      .not("job_role", "is", null)
      .limit(200),
    supabase
      .from("worker")
      .select("city, state")
      .eq("tenant_id", tenantId)
      .limit(200),
  ]);

  const roles = uniqueLimited(
    [
      job.title,
      job.specialty,
      ...(roleRows ?? []).map((row) => asText((row as { job_role?: string }).job_role)),
    ],
    40
  );
  const locations = uniqueLimited(
    (locationRows ?? []).map((row) => {
      const city = asText((row as { city?: string }).city);
      const state = asText((row as { state?: string }).state);
      return [city, state].filter(Boolean).join(", ");
    }),
    40
  );
  const statuses = ACTIVE_CANDIDATE_PIPELINE_STATUSES.map((id) => ({
    id,
    name: formatPipelineStatusLabel(id),
    color: pipelineStatusColor(id),
  }));

  return {
    locations,
    roles,
    statuses,
    suggestedRoles: uniqueLimited([job.title, job.specialty], 8),
  };
}

export async function searchCandidatesForImport(
  supabase: DbClient,
  input: {
    tenantId: string;
    jobId: string;
    params: ImportSearchParams;
  }
): Promise<ImportSearchResult> {
  const jobRow = await loadJobForImport(supabase, input.tenantId, input.jobId);
  const job = jobProfileFromWorkspace(jobRow);
  const sqlIds = await resolveSqlWorkerIds(supabase, {
    tenantId: input.tenantId,
    jobId: input.jobId,
    job,
    params: input.params,
  });

  const [{ rows, sqlTotal }, allTotal, facets] = await Promise.all([
    fetchWorkerPage(supabase, {
      tenantId: input.tenantId,
      ids: sqlIds,
      params: input.params,
      specialty: job.specialty,
      limit: IMPORT_MATCH_FETCH_CAP,
    }),
    countTenantWorkers(supabase, input.tenantId),
    loadFacets(supabase, input.tenantId, job),
  ]);

  const related = await loadRelatedCandidateData(
    supabase,
    input.tenantId,
    input.jobId,
    rows.map((row) => row.id)
  );

  const scored: ImportCandidateView[] = [];
  for (const row of rows) {
    const fullName = workerFullName(row);
    const location = workerLocation(row);
    const previousTitles = related.titles.get(row.id) ?? [];
    const resumeText = related.resumes.get(row.id) ?? "";
    const notes = related.notes.get(row.id) ?? "";
    const profileSkills = related.skills.get(row.id) ?? [];
    const currentRole =
      related.currentRoles.get(row.id) || asText(row.job_role) || "";
    const match = scoreCandidateAgainstJob(job, {
      fullName,
      specialty: row.job_role,
      location,
      currentRole,
      previousTitles,
      resumeText: `${resumeText}\n${profileSkills.join(" ")}`,
      notes,
    });

    const skillHay = candidateHaystack({
      fullName,
      specialty: row.job_role,
      location,
      currentRole,
      previousTitles,
      resumeText: `${resumeText}\n${profileSkills.join(" ")}`,
      notes,
    });
    if (input.params.skills.length && !skillsPresentInHaystack(skillHay, input.params.skills)) {
      continue;
    }
    if (
      input.params.tags.length &&
      !tagsPresentInHaystack(`${match.tags.join(" ")} ${asText(row.job_role)} ${resumeText}`, input.params.tags)
    ) {
      continue;
    }
    if (!experienceBucketMatch(match.yearsExperience, input.params.experience)) continue;
    if (match.score < input.params.minMatch) continue;
    if (input.params.role) {
      const roleHay = `${asText(row.job_role)} ${previousTitles.join(" ")}`.toLowerCase();
      if (!phrasePresent(roleHay, input.params.role) && !roleHay.includes(input.params.role.toLowerCase())) {
        continue;
      }
    }

    scored.push({
      id: row.id,
      fullName,
      currentRole: currentRole || asText(row.job_role),
      location,
      yearsExperience: match.yearsExperience,
      topSkills: match.matchedSkills,
      tags: match.tags,
      matchScore: match.score,
      matchReasons: match.reasons,
      statusName: formatPipelineStatusLabel(row.status),
      statusColor: pipelineStatusColor(row.status),
      alreadyAdded: related.alreadyAdded.has(row.id),
      experienceHighlights: match.experienceHighlights,
    });
  }

  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.fullName.localeCompare(b.fullName);
  });

  const recommendedTotal = scored.filter((row) => row.matchScore >= IMPORT_RECOMMENDED_MIN_SCORE).length;
  const total = scored.length;
  const start = (input.params.page - 1) * input.params.pageSize;
  const candidates = scored.slice(start, start + input.params.pageSize);

  return {
    candidates,
    total,
    allTotal,
    recommendedTotal: input.params.tab === "recommended" ? total : recommendedTotal,
    page: input.params.page,
    pageSize: input.params.pageSize,
    truncated: sqlTotal > IMPORT_MATCH_FETCH_CAP,
    job: {
      id: jobRow.id,
      title: asText(jobRow.public_title) || "Untitled job",
      jobRef: jobRefOf(jobRow),
    },
    suggestedTags: job.tags.slice(0, 16),
    suggestedSkills: uniqueLimited([...job.requiredSkills, ...job.preferredSkills], 16),
    suggestedRoles: facets.suggestedRoles,
    facets: {
      locations: facets.locations,
      roles: facets.roles,
      statuses: facets.statuses,
    },
  };
}

async function ensureApplicantProfileForWorker(
  supabase: DbClient,
  tenantId: string,
  worker: WorkerImportRow
): Promise<string | null> {
  const { data: existing, error: lookupError } = await supabase
    .from("applicant_profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", worker.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) return String(existing.id);

  const email = asText(worker.email);
  const normalizedEmail = email ? normalizeApplicantEmail(email) : "";
  if (normalizedEmail) {
    const { data: byEmail, error: emailError } = await supabase
      .from("applicant_profiles")
      .select("id, worker_id")
      .eq("tenant_id", tenantId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (emailError) throw emailError;
    if (byEmail?.id) {
      if (!byEmail.worker_id) {
        await supabase
          .from("applicant_profiles")
          .update({ worker_id: worker.id, updated_at: new Date().toISOString() })
          .eq("id", byEmail.id)
          .eq("tenant_id", tenantId);
      }
      return String(byEmail.id);
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("applicant_profiles")
    .insert({
      tenant_id: tenantId,
      worker_id: worker.id,
      email: email || null,
      normalized_email: normalizedEmail || `worker-${worker.id}@imported.invalid`,
      first_name: asText(worker.first_name) || "Candidate",
      last_name: asText(worker.last_name) || null,
      phone: asText(worker.phone) || null,
      last_job_title: asText(worker.job_role) || null,
    })
    .select("id")
    .single();
  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const { data: raced } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("worker_id", worker.id)
        .maybeSingle();
      return raced?.id ? String(raced.id) : null;
    }
    throw insertError;
  }
  return created?.id ? String(created.id) : null;
}

export async function importExistingCandidatesToWorkspace(
  supabase: DbClient,
  input: {
    tenantId: string;
    jobId: string;
    staffUserId: string | null;
    candidateIds: unknown;
    request?: Request;
  }
): Promise<ImportMutationResult> {
  const parsed = normalizeImportCandidateIds(input.candidateIds);
  if (parsed.invalid) {
    throw new CandidateImportError(
      "Each candidate must be referenced by its database ID.",
      "INVALID_ID",
      400
    );
  }
  if (parsed.empty) {
    throw new CandidateImportError("At least one candidate is required.", "EMPTY", 400);
  }
  if (parsed.tooMany) {
    throw new CandidateImportError("You can import at most 50 candidates at a time.", "TOO_MANY", 400);
  }

  const jobRow = await loadJobForImport(supabase, input.tenantId, input.jobId);
  if (asText(jobRow.status) !== "published") {
    throw new CandidateImportError(
      "Only published jobs can accept candidates. Publish the job first.",
      "JOB_NOT_PUBLISHED",
      400
    );
  }
  if (!jobRow.workflow_id) {
    throw new CandidateImportError(
      "This job is unavailable or has no workflow assigned.",
      "JOB_UNAVAILABLE",
      400
    );
  }

  let assignedFlow;
  try {
    assignedFlow = await resolvePublishedFlowForJobWorkflow(
      supabase,
      input.tenantId,
      String(jobRow.workflow_id)
    );
  } catch (error) {
    if (error instanceof JobValidationError) {
      throw new CandidateImportError(error.message, "JOB_UNAVAILABLE", 400);
    }
    throw error;
  }

  const ids = parsed.ids;
  const { data: alreadyRows, error: alreadyError } = await supabase
    .from("job_applications")
    .select("worker_id")
    .eq("tenant_id", input.tenantId)
    .eq("job_requisition_id", input.jobId)
    .in("worker_id", ids)
    .not("status", "in", INACTIVE_APPLICATION_STATUSES);
  if (alreadyError) throw alreadyError;
  const skippedAlreadyAdded = Array.from(
    new Set((alreadyRows ?? []).map((row) => asText(row.worker_id)).filter(Boolean))
  );
  const remaining = ids.filter((id) => !skippedAlreadyAdded.includes(id));

  const { data: workerRows, error: workerError } = remaining.length
    ? await supabase
        .from("worker")
        .select(
          "id, first_name, last_name, email, phone, job_role, city, state, address1, address2, zip, status, updated_at, created_at"
        )
        .eq("tenant_id", input.tenantId)
        .in("id", remaining)
    : { data: [], error: null };
  if (workerError) throw workerError;
  const workers = (workerRows ?? []) as WorkerImportRow[];
  const foundIds = new Set(workers.map((row) => row.id));
  const skippedNotFound = remaining.filter((id) => !foundIds.has(id));
  const toInsert = workers.filter((row) => foundIds.has(row.id));

  const resumeByWorker = new Map<string, string>();
  if (toInsert.length) {
    const resumeResult = await queryInChunks(
      toInsert.map((row) => row.id),
      async (chunk) => {
        const result = await supabase
          .from("worker_resumes")
          .select("worker_id, extracted_text, uploaded_at")
          .eq("tenant_id", input.tenantId)
          .in("worker_id", chunk)
          .is("deleted_at", null)
          .order("uploaded_at", { ascending: false });
        return { data: result.data ?? [], error: result.error };
      }
    );
    if (resumeResult.error) throw resumeResult.error;
    for (const row of resumeResult.data as Array<{ worker_id?: string | null; extracted_text?: string | null }>) {
      const workerId = asText(row.worker_id);
      if (!workerId || resumeByWorker.has(workerId)) continue;
      resumeByWorker.set(workerId, asText(row.extracted_text));
    }
  }

  const imported: string[] = [];
  const racedAlready: string[] = [];
  const nowIso = new Date().toISOString();

  for (const worker of toInsert) {
    const profileId = await ensureApplicantProfileForWorker(supabase, input.tenantId, worker);
    const resumeText = resumeByWorker.get(worker.id) ?? "";
    const aiMatchStatus = resumeText.length > 40 ? "READY" : "NEEDS_REVIEW";

    const { data: application, error: insertError } = await supabase
      .from("job_applications")
      .insert({
        tenant_id: input.tenantId,
        job_requisition_id: jobRow.id,
        applicant_profile_id: profileId,
        workflow_id: assignedFlow.id,
        worker_id: worker.id,
        status: "new",
        submitted_at: nowIso,
        source: "admin",
        created_by_staff_user_id: input.staffUserId,
        assigned_recruiter_user_id: input.staffUserId,
        ai_match_status: aiMatchStatus,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        racedAlready.push(worker.id);
        continue;
      }
      throw insertError;
    }
    if (!application?.id) {
      racedAlready.push(worker.id);
      continue;
    }

    try {
      await attachWorkflowInstanceToApplication(supabase, {
        tenantId: input.tenantId,
        applicationId: String(application.id),
        jobRequisitionId: String(jobRow.id),
        workflowId: assignedFlow.id,
        workerId: worker.id,
        flow: {
          name: assignedFlow.name,
          builder_draft: assignedFlow.builderDraft,
          updated_at: assignedFlow.updatedAt,
        },
      });
    } catch (error) {
      await supabase.from("job_applications").delete().eq("id", application.id);
      throw error;
    }

    imported.push(worker.id);

    const activityRows = [
      {
        tenant_id: input.tenantId,
        recruiter_user_id: input.staffUserId,
        candidate_id: worker.id,
        job_id: jobRow.id,
        analysis_id: null,
        note_id: null,
        activity_type: "CANDIDATE_IMPORTED",
        action_label: "Imported candidate to job",
        previous_value: null,
        new_value: input.jobId,
        metadata: { source: "import_existing", workspace_id: input.jobId },
        source: "recruiter",
        request_id: `import:${input.jobId}:${worker.id}`,
      },
      {
        tenant_id: input.tenantId,
        recruiter_user_id: input.staffUserId,
        candidate_id: worker.id,
        job_id: jobRow.id,
        analysis_id: null,
        note_id: null,
        activity_type: "CANDIDATE_ADDED_TO_JOB",
        action_label: "Added candidate to job",
        previous_value: null,
        new_value: input.jobId,
        metadata: { source: "import_existing", workspace_id: input.jobId },
        source: "recruiter",
        request_id: `import-added:${input.jobId}:${worker.id}`,
      },
    ];
    const { error: activityError } = await supabase.from("recruiter_activity_logs").insert(activityRows);
    if (activityError) {
      console.error("[candidate-import] recruiter_activity_logs insert failed:", activityError.message);
    }
  }

  const skippedAlready = [...skippedAlreadyAdded, ...racedAlready];
  if (imported.length) {
    void writeActivityLog({
      actorUserId: input.staffUserId,
      action: "CANDIDATES_IMPORTED_TO_JOB",
      entityType: "job_requisition",
      entityId: input.jobId,
      tenantId: input.tenantId,
      request: input.request,
      metadata: {
        imported_count: imported.length,
        skipped_count: skippedAlready.length + skippedNotFound.length,
      },
    });
  }

  const importedCount = imported.length;
  const skippedAlreadyAddedCount = skippedAlready.length;
  return {
    imported,
    skippedAlreadyAdded: skippedAlready,
    skippedNotFound,
    importedCount,
    skippedCount: skippedAlreadyAddedCount,
    skippedNotFoundCount: skippedNotFound.length,
    jobTitle: asText(jobRow.public_title) || "Untitled job",
    jobRef: jobRefOf(jobRow),
    message: buildImportResultMessage(importedCount, skippedAlreadyAddedCount),
  };
}
