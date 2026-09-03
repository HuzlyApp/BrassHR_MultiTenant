import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { attachWorkerProfilePhotoUrls } from "@/lib/applicant-portal/worker-profile-photo";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { getApplicationStatusSummariesForWorkers } from "@/lib/jobs/application-statuses/attach-worker-application-status";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import { applyWorkerTenantEq } from "@/lib/workers/tenant-query";
import {
  isApprovedPendingConversion,
  shouldExcludeFromApprovedCandidates,
  shouldExcludeFromCandidateLists,
} from "@/lib/workers/candidate-conversion-filter";
import { ACTIVE_CANDIDATE_PIPELINE_STATUSES } from "@/lib/workers/candidate-status-label";
import type { WorkerStatus } from "@/lib/workers/workers-status-types";
import { getAppliedJobCountsByWorker } from "@/lib/workers/applied-job-count";
import {
  getApplicationJobTitlesByWorker,
  joinApplicationJobTitles,
} from "@/lib/workers/worker-application-job-titles";
import { getWorkerJobMatchSummaries } from "@/lib/workers/worker-job-match-summary";
import { getApplicationSearchTextByWorker } from "@/lib/workers/worker-application-search-index";
import { parseWorkersListParams, statusOrFilter } from "@/lib/workers/workers-status-filter";
import { loadRequirementOutcomeCountsByApplication } from "@/lib/jobs/match-analysis/load-requirement-outcome-counts";

type SbErr = { message: string; code?: string };
type ContactLookupRow = {
  id: string | null;
  email: string | null;
  phone: string | null;
};

function parseStatus(v: string | null): WorkerStatus | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (
    s === "new" ||
    s === "pending" ||
    s === "for_approval" ||
    s === "approved" ||
    s === "disapproved" ||
    s === "active" ||
    s === "inactive" ||
    s === "cancelled" ||
    s === "banned"
  ) {
    return s;
  }
  return null;
}

const PIPELINE_STATUSES = new Set<WorkerStatus>([
  "new",
  "pending",
  "for_approval",
  "approved",
  "disapproved",
]);

/** Recruiter pipeline stages stored only in text `status` — not the legacy enum. */
const PIPELINE_TEXT_ONLY = new Set<WorkerStatus>([
  "pending",
  "for_approval",
  "approved",
  "disapproved",
]);

/** Legacy employment labels stored in text `status` — not recruiter pipeline stages. */
const EMPLOYMENT_ONLY_STATUSES = new Set<WorkerStatus>([
  "active",
  "inactive",
  "cancelled",
  "banned",
]);

function statusQueryAttempts(
  status: WorkerStatus | null,
  pipelineStatus: boolean,
  pipelineSelectExtra: string
): Array<{ col: "status" | "worker_status"; extra: string }> {
  if (pipelineStatus) {
    if (status && PIPELINE_TEXT_ONLY.has(status)) {
      return [{ col: "status", extra: pipelineSelectExtra }];
    }
    return [
      { col: "status", extra: pipelineSelectExtra },
      { col: "worker_status", extra: pipelineSelectExtra },
    ];
  }
  if (status && EMPLOYMENT_ONLY_STATUSES.has(status)) {
    return [
      { col: "worker_status", extra: pipelineSelectExtra },
      { col: "status", extra: pipelineSelectExtra },
    ];
  }
  return [
    { col: "status", extra: pipelineSelectExtra },
    { col: "worker_status", extra: "worker_status" },
  ];
}

/** Prefer text `status` (recruiter pipeline); fall back to enum `worker_status`. */
function resolveWorkerDisplayStatus(row: Record<string, unknown>): string | null {
  const pipeline =
    typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  const legacy =
    typeof row.worker_status === "string"
      ? row.worker_status.trim().toLowerCase()
      : "";

  if (pipeline) {
    if (PIPELINE_STATUSES.has(pipeline as WorkerStatus)) return pipeline;
    if (!EMPLOYMENT_ONLY_STATUSES.has(pipeline as WorkerStatus)) return pipeline;
  }

  if (legacy && PIPELINE_STATUSES.has(legacy as WorkerStatus)) return legacy;
  if (pipeline) return pipeline;
  if (legacy) return legacy;
  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;
    const tenantScope = await resolveStaffTenantScope(auth.authUser);

    const urlObj = new URL(req.url);
    const status = parseStatus(
      urlObj.searchParams.get("worker_status") ??
        urlObj.searchParams.get("status")
    );
    const headOnly = urlObj.searchParams.get("head") === "1";
    const includePhotoUrls = urlObj.searchParams.get("includePhotoUrls") === "1";
    const conversionFilter = urlObj.searchParams.get("conversion")?.trim().toLowerCase() ?? "";
    const { limit, offset } = parseWorkersListParams(urlObj.searchParams);
    const needsConversionFilter =
      conversionFilter === "pending" ||
      status == null ||
      (status === "approved" && conversionFilter !== "all");
    const queryLimit = limit;
    const queryOffset = offset;

    const url = getSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const anonKey = getSupabaseAnonKey();
    /** Prefer service role; fall back to anon if missing or rejected (e.g. wrong key in .env). */
    const keys = [serviceKey, anonKey].filter(
      (k): k is string => Boolean(k)
    );

    if (!url || keys.length === 0) {
      return Response.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      );
    }

    let lastMessage = "Failed to load workers";

    const isMissingColumnErr = (e: unknown) => {
      const err = e as { code?: string; message?: string } | null;
      if (!err) return false;
      // Postgres undefined_column
      if (err.code === "42703") return true;
      return typeof err.message === "string" && err.message.includes(" does not exist");
    };

    const isInvalidEnumErr = (e: unknown) => {
      const err = e as { code?: string; message?: string } | null;
      if (!err) return false;
      if (err.code === "22P02") return true;
      return (
        typeof err.message === "string" &&
        err.message.includes("invalid input value for enum")
      );
    };

    for (const key of keys) {
      const supabase = createClient(url, key);
      const baseColsOptions =
        tenantScope.mode === "scoped"
          ? ([
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, tenant_id, profile_photo, assigned_recruiter_user_id",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, tenant_id, profile_photo",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, tenant_id",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, created_at, tenant_id",
            ] as const)
          : ([
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, profile_photo, assigned_recruiter_user_id",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at, profile_photo",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, zip, created_at",
              "id, user_id, first_name, last_name, job_role, email, phone, address1, city, state, created_at",
            ] as const);

      // Applicant pipeline statuses live in text column `status`. Some databases also have an
      // unrelated enum `worker_status`, which does not accept values like "approved".
      const pipelineStatus =
        status === "new" ||
        status === "pending" ||
        status === "for_approval" ||
        status === "approved" ||
        status === "disapproved";
      const pipelineSelectExtra = "status, worker_status";
      const attempts = statusQueryAttempts(status, pipelineStatus, pipelineSelectExtra);

      let data: unknown[] | null = null;
      let error: SbErr | null = null;
      let count: number | null = null;

      outer: for (const baseCols of baseColsOptions) {
        for (const a of attempts) {
          const select = `${baseCols}, ${a.extra}`;

          let q = supabase.from("worker").select(select, { count: "exact", head: headOnly });
          q = applyWorkerTenantEq(q, tenantScope) as typeof q;
          if (status) {
            q = q.or(statusOrFilter(a.col, status)) as typeof q;
          } else if (a.col === "status") {
            // All candidates tab: active pipeline only (exclude converted workers).
            const active = ACTIVE_CANDIDATE_PIPELINE_STATUSES.join(",");
            q = q.or(`status.in.(${active}),status.is.null`) as typeof q;
          }
          q = q.order("created_at", { ascending: false }) as typeof q;
          if (!headOnly) {
            q = q.range(queryOffset, queryOffset + queryLimit - 1) as typeof q;
          }

          const res = await q;
          data = (res.data as unknown[] | null) ?? null;
          error = res.error
            ? { message: res.error.message, code: (res.error as { code?: string }).code }
            : null;
          count = typeof res.count === "number" ? res.count : null;

          if (!error) {
            const hasResults = headOnly
              ? (count ?? 0) > 0
              : ((data as unknown[] | null)?.length ?? 0) > 0;
            if (hasResults) break outer;
            if (status && PIPELINE_TEXT_ONLY.has(status)) break outer;
            continue;
          }
          if (!isMissingColumnErr(error) && !isInvalidEnumErr(error)) break outer;
        }
      }

      if (!error) {
        let normalized: Record<string, unknown>[] = (data ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          const s = resolveWorkerDisplayStatus(r);
          return { ...r, status: s };
        });

        const shouldFilterConversion = !headOnly && needsConversionFilter;

        if (shouldFilterConversion && normalized.length > 0) {
          const candidateIds = normalized
            .map((row) => (typeof row.id === "string" ? row.id : ""))
            .filter(Boolean);
          const { data: employmentRows, error: employmentErr } = await queryInChunks(
            candidateIds,
            async (chunk) => {
              const result = await supabase
                .from("workers")
                .select("candidate_id")
                .in("candidate_id", chunk);
              return {
                data: (result.data ?? []) as Array<{ candidate_id?: string }>,
                error: result.error,
              };
            }
          );
          if (employmentErr && !isMissingColumnErr(employmentErr)) {
            const sbEmploymentErr = employmentErr as SbErr;
            error = {
              message: sbEmploymentErr.message || "Supabase query failed",
              code: sbEmploymentErr.code,
            };
          } else {
            const convertedIds = new Set(
              ((employmentRows as { candidate_id?: string }[] | null) ?? [])
                .map((row) => String(row.candidate_id ?? ""))
                .filter(Boolean)
            );
            normalized = normalized.filter((row) => {
              const rowStatus = typeof row.status === "string" ? row.status : null;
              const rowId = typeof row.id === "string" ? row.id : "";
              const hasEmployment = convertedIds.has(rowId);
              if (conversionFilter === "pending") {
                return isApprovedPendingConversion(rowStatus, hasEmployment);
              }
              if (status == null) {
                return !shouldExcludeFromCandidateLists(rowStatus, hasEmployment);
              }
              return !shouldExcludeFromApprovedCandidates(rowStatus, hasEmployment);
            });
          }
        }

        const filteredTotal = normalized.length;
        const paged = normalized;
        const total = shouldFilterConversion ? (count ?? filteredTotal) : (count ?? paged.length);
        const hasMore = !headOnly && queryOffset + (data?.length ?? 0) < (count ?? 0);

        if (error) {
          const errMsg = error.message || "Supabase query failed";
          lastMessage = errMsg;
          console.error("Supabase error:", error);
          const retry = errMsg === "Invalid API key" && key === serviceKey && anonKey;
          if (!retry) {
            return Response.json({ error: errMsg }, { status: 500 });
          }
          continue;
        }

        const withContacts = async () => {
          if (headOnly) return [];
          const rows = paged as Array<Record<string, unknown>>;
          if (rows.length === 0) return [];

          const userIds = Array.from(
            new Set(
              rows
                .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
                .filter(Boolean)
            )
          );
          const workerIds = Array.from(
            new Set(
              rows
                .map((row) => (typeof row.id === "string" ? row.id : ""))
                .filter(Boolean)
            )
          );

          let usersById = new Map<string, ContactLookupRow>();
          if (userIds.length > 0) {
            const { data: usersData, error: usersError } = await queryInChunks(
              userIds,
              async (chunk) => {
                const result = await supabase
                  .from("users")
                  .select("id, email, phone")
                  .in("id", chunk);
                return {
                  data: (result.data ?? []) as ContactLookupRow[],
                  error: result.error,
                };
              }
            );
            if (usersError) {
              console.warn("Failed to load users contact data:", usersError);
            } else {
              usersById = new Map(
                usersData.filter((u) => Boolean(u.id)).map((u) => [String(u.id), u])
              );
            }
          }

          let applicantsById = new Map<string, ContactLookupRow>();
          if (workerIds.length > 0) {
            const { data: applicantsData, error: applicantsError } = await queryInChunks(
              workerIds,
              async (chunk) => {
                const result = await supabase
                  .from("applicants")
                  .select("id, email, phone")
                  .in("id", chunk);
                return {
                  data: (result.data ?? []) as ContactLookupRow[],
                  error: result.error,
                };
              }
            );
            if (applicantsError) {
              console.warn("Failed to load applicants contact data:", applicantsError);
            } else {
              applicantsById = new Map(
                applicantsData.filter((a) => Boolean(a.id)).map((a) => [String(a.id), a])
              );
            }
          }

          return rows.map((row) => {
            const workerId = typeof row.id === "string" ? row.id : "";
            const userId = typeof row.user_id === "string" ? row.user_id : "";
            const userContact = userId ? usersById.get(userId) : undefined;
            const applicantContact = workerId ? applicantsById.get(workerId) : undefined;
            return {
              ...row,
              user_email: userContact?.email ?? null,
              user_phone: userContact?.phone ?? null,
              applicant_email: applicantContact?.email ?? null,
              applicant_phone: applicantContact?.phone ?? null,
            };
          });
        };

        const enriched = await withContacts();
        let withPhotos: Record<string, unknown>[] = headOnly ? [] : enriched;
        if (!headOnly && includePhotoUrls) {
          try {
            withPhotos = await attachWorkerProfilePhotoUrls(
              supabase,
              enriched as Record<string, unknown>[]
            );
          } catch (photoErr) {
            console.warn("[api/workers] failed to attach profile photo urls", photoErr);
            withPhotos = (enriched as Record<string, unknown>[]).map((row) => ({
              ...row,
              profile_photo_url: null,
            }));
          }
        } else if (!headOnly) {
          withPhotos = (enriched as Record<string, unknown>[]).map((row) => ({
            ...row,
            profile_photo_url:
              typeof row.profile_photo === "string" && row.profile_photo.startsWith("http")
                ? row.profile_photo
                : null,
          }));
        }

        let workersOut: Record<string, unknown>[] = headOnly ? [] : withPhotos;

        if (!headOnly && workersOut.length > 0) {
          try {
            const tenantIdForApps =
              tenantScope.mode === "scoped"
                ? tenantScope.tenantId
                : typeof workersOut[0]?.tenant_id === "string"
                  ? workersOut[0].tenant_id
                  : null;
            const workerIds = workersOut
              .map((row) => (typeof row.id === "string" ? row.id : ""))
              .filter(Boolean);
            const [summaries, appliedJobCounts, matchSummaries, jobTitlesByWorker, searchTextByWorker] =
              await Promise.all([
              getApplicationStatusSummariesForWorkers(supabase, {
                tenantId: tenantIdForApps,
                workerIds,
              }),
              getAppliedJobCountsByWorker(supabase, tenantIdForApps, workerIds),
              getWorkerJobMatchSummaries(supabase, {
                tenantId: tenantIdForApps,
                workerIds,
              }),
              getApplicationJobTitlesByWorker(supabase, {
                tenantId: tenantIdForApps,
                workerIds,
              }),
              getApplicationSearchTextByWorker(supabase, {
                tenantId: tenantIdForApps,
                workerIds,
              }),
            ]);
            const matchApplicationIds = [
              ...new Set(
                [...matchSummaries.values()]
                  .map((match) => match.applicationId?.trim())
                  .filter((id): id is string => Boolean(id))
              ),
            ];
            let requirementCountsByApplication = new Map<
              string,
              { confirmed: number; verify: number; notMet: number }
            >();
            if (tenantIdForApps && matchApplicationIds.length > 0) {
              try {
                requirementCountsByApplication = await loadRequirementOutcomeCountsByApplication(
                  supabase,
                  tenantIdForApps,
                  matchApplicationIds
                );
              } catch (countsErr) {
                console.warn("[api/workers] failed to attach requirement counts", countsErr);
              }
            }
            workersOut = workersOut.map((row) => {
              const id = typeof row.id === "string" ? row.id : "";
              const summary = id ? summaries.get(id) : undefined;
              const appliedJobCount = id ? appliedJobCounts.get(id) ?? 1 : 1;
              const match = id ? matchSummaries.get(id) : undefined;
              const jobTitles = id ? jobTitlesByWorker.get(id) : undefined;
              const applicationJobTitlesText = joinApplicationJobTitles(jobTitles);
              const applicationSearchText = id ? searchTextByWorker.get(id) : undefined;
              return {
                ...row,
                applied_job_count: appliedJobCount,
                ...(summary
                  ? {
                      application_id: summary.applicationId,
                      application_status_id: summary.statusId,
                      application_status_name: summary.statusName,
                      application_status_key: summary.systemKey,
                      application_status_ambiguous: summary.ambiguous,
                      application_job_title: summary.jobTitle,
                    }
                  : {}),
                ...(applicationJobTitlesText
                  ? { application_job_titles_text: applicationJobTitlesText }
                  : {}),
                ...(applicationSearchText ? { application_search_text: applicationSearchText } : {}),
                ...(match
                  ? {
                      match_application_id: match.applicationId,
                      ai_match_status: match.status,
                      ai_match_score: match.score,
                      ai_match_category: match.category,
                      ai_match_display_category: match.displayCategory,
                      ai_requirement_counts:
                        requirementCountsByApplication.get(match.applicationId) ?? null,
                    }
                  : {}),
              };
            });
          } catch (attachErr) {
            console.warn("[api/workers] failed to attach application statuses", attachErr);
          }
        }

        return Response.json({
          total,
          limit,
          offset,
          hasMore,
          workers: workersOut,
        });
      }

      const errMsg = error?.message || "Supabase query failed";
      lastMessage = errMsg;
      console.error("Supabase error:", error);
      const retry =
        errMsg === "Invalid API key" && key === serviceKey && anonKey;
      if (!retry) {
        return Response.json({ error: errMsg }, { status: 500 });
      }
    }

    return Response.json({ error: lastMessage }, { status: 500 });
  } catch (err: unknown) {
    console.error("API ERROR:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}